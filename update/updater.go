package update

import (
	"containerup/adapter"
	"containerup/system"
	"context"
	"errors"
	"fmt"
	nettypes "github.com/containers/common/libnetwork/types"
	"github.com/containers/podman/v4/libpod/define"
	"github.com/containers/podman/v4/pkg/api/handlers"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/containers/podman/v4/pkg/domain/entities"
	"github.com/containers/podman/v4/pkg/specgen"
	"github.com/containers/podman/v4/pkg/util"
	"github.com/docker/docker/api/types"
	spec "github.com/opencontainers/runtime-spec/specs-go"
	"io"
	"log"
	"os"
	"strconv"
	"sync"
	"time"
)

var (
	podmanURL = "unix:/run/podman/podman.sock"
)

func Updater() {
	if !updater() {
		os.Exit(1)
	}
	os.Exit(0)
}

func updater() (success bool) {
	log.Printf("You're running ContainerUp updater")

	image := os.Getenv(system.ENV_UPDATE_IMAGE)
	if image == "" {
		log.Fatalf("Empty env var %s", system.ENV_UPDATE_IMAGE)
	}
	log.Printf("New image: %s", image)

	currentContainerId := os.Getenv(system.ENV_UPDATE_CURRENT_ID)
	if currentContainerId == "" {
		log.Fatalf("Empty env var %s", system.ENV_UPDATE_CURRENT_ID)
	}
	log.Printf("Current container: %s", currentContainerId)

	ctx0, err := adapter.NewConnection(context.Background(), podmanURL)
	if err != nil {
		log.Fatalf("Cannot connect to Podman: %v", err)
	}

	ctx0, cancel0 := context.WithTimeout(ctx0, time.Second*120)
	defer cancel0()

	ctx, cancel := context.WithTimeout(ctx0, time.Second*60)
	defer cancel()

	log.Printf("Stopping the current container")
	err = adapter.ContainerStop(ctx, currentContainerId, (&containers.StopOptions{}).WithTimeout(10))
	defer func() {
		if !success {
			err = adapter.ContainerStart(ctx0, currentContainerId, nil)
			log.Printf("Restart the current container, result err: %v", err)
		}
	}()
	if err != nil {
		log.Printf("Cannot stop current container: %v", err)
		return false
	}

	log.Printf("Inspecting the current container")
	inspect, err := adapter.ContainerInspect(ctx, currentContainerId, nil)
	if err != nil {
		log.Printf("Cannot inspect the current container: %v", err)
		return false
	}

	renameName := inspect.Name + "-old"
	log.Printf("Rename the current container to %s", renameName)
	err = adapter.ContainerRename(ctx, currentContainerId, (&containers.RenameOptions{}).WithName(renameName))
	if err != nil {
		log.Printf("Cannot rename the current container: %v", err)
		return false
	}
	defer func() {
		if !success {
			err = adapter.ContainerRename(ctx0, currentContainerId, (&containers.RenameOptions{}).WithName(inspect.Name))
			log.Printf("Revert rename of the current container, result err: %v", err)
		}
	}()

	rpt, err := createNewContainer(ctx, image, inspect)
	if err != nil {
		log.Printf("Cannot create a new container: %v", err)
		return false
	}
	log.Printf("Created: %s", rpt.ID)
	defer func() {
		if !success {
			renameName = inspect.Name + "-update-failure"
			err = adapter.ContainerRename(ctx0, rpt.ID, (&containers.RenameOptions{}).WithName(renameName))
			log.Printf("Rename the new container to %s, result err: %v", renameName, err)
		}
	}()

	log.Printf("Starting the new container")
	err = adapter.ContainerStart(ctx, rpt.ID, nil)
	if err != nil {
		log.Printf("Cannot start the new container: %v", err)
		return false
	}
	log.Printf("Started: %s", rpt.ID)
	defer func() {
		if !success {
			err = adapter.ContainerStop(ctx0, rpt.ID, (&containers.StopOptions{}).WithTimeout(10))
			log.Printf("Stop the new container, result err: %v", err)
		}
	}()

	fatal := true
	for i := 0; i < 3; i++ {
		time.Sleep(2 * time.Second)
		log.Printf("Checking the status of the new container")

		envs := []string{"CONTAINERUP_UPDATE_PING=1"}
		respStdOut, respStdErr, err := containerExec(ctx, rpt.ID, envs, []string{"/usr/bin/containerup"})
		if err != nil {
			log.Printf("Cannot check the status: %v", err)
			continue
		}
		log.Printf("Result stdout: %s", respStdOut)
		log.Printf("Result stderr: %s", respStdErr)
		fatal = false
		break
	}
	if fatal {
		return false
	}

	log.Printf("Update succeeded!")

	_, err = adapter.ContainerRemove(ctx, currentContainerId, nil)
	if err != nil {
		log.Printf("Cannot remove old container: %v", err)
	}

	_, _ = adapter.ContainerRemove(ctx, currentContainerId, nil)

	updaterHostname := system.ContainerHostname()
	if updaterHostname != "" {
		_, _ = adapter.ContainerRemove(ctx, updaterHostname, (&containers.RemoveOptions{}).WithForce(true).WithTimeout(10))
	}

	return true
}

func createNewContainer(ctx context.Context, image string, current *define.InspectContainerData) (entities.ContainerCreateResponse, error) {
	rpt := entities.ContainerCreateResponse{}
	createCmd := []string{"podman", "run", "-d"}

	s := specgen.NewSpecGenerator(image, false)
	s.Name = current.Name
	createCmd = append(createCmd, "--name", s.Name)

	log.Printf("Parsing the configuration of the current container")
	s.Env = make(map[string]string)
	if val := getCurrentEnv(current, system.ENV_USERNAME); val != "" {
		s.Env[system.ENV_USERNAME] = val
		createCmd = append(createCmd, "--env", fmt.Sprintf("%s=%s", system.ENV_USERNAME, val))
	}
	if val := getCurrentEnv(current, system.ENV_PASSWORD_HASH); val != "" {
		s.Env[system.ENV_PASSWORD_HASH] = val
		createCmd = append(createCmd, "--env", fmt.Sprintf("%s=%s", system.ENV_PASSWORD_HASH, val))
	} else {
		return rpt, fmt.Errorf("cannot find env %s", system.ENV_PASSWORD_HASH)
	}
	if val := getCurrentEnv(current, system.ENV_PODMAN_V3); val != "" {
		s.Env[system.ENV_PODMAN_V3] = val
		createCmd = append(createCmd, "--env", fmt.Sprintf("%s=%s", system.ENV_PODMAN_V3, val))
	}

	isTls := false
	if tlsCert := getCurrentEnv(current, system.ENV_TLS_CERT); tlsCert != "" {
		tlsKey := getCurrentEnv(current, system.ENV_TLS_KEY)
		if tlsKey == "" {
			return rpt, fmt.Errorf("empty %s while %s is not empty", system.ENV_TLS_KEY, system.ENV_TLS_CERT)
		}
		isTls = true

		s.Env[system.ENV_TLS_CERT] = tlsCert
		s.Env[system.ENV_TLS_KEY] = tlsKey
		createCmd = append(createCmd, "--env", fmt.Sprintf("%s=%s", system.ENV_TLS_CERT, tlsCert))
		createCmd = append(createCmd, "--env", fmt.Sprintf("%s=%s", system.ENV_TLS_KEY, tlsKey))
	}

	if src := system.GetCurrentVolumePodmanURL(current); src != "" {
		s.Mounts = []spec.Mount{{
			Destination: system.URL_PODMAN,
			Type:        "bind",
			Source:      src,
		}}
		createCmd = append(createCmd, "--volume", fmt.Sprintf("%s:%s", src, system.URL_PODMAN))
	} else {
		return rpt, errors.New("cannot find URL of Podman")
	}

	mountCount := 0
	for _, mount := range getOtherVolumeMounts(current) {
		ro := ""
		if !mount.RW {
			ro = ":ro"
		}
		s.Mounts = append(s.Mounts, spec.Mount{
			Destination: mount.Destination,
			Type:        mount.Type,
			Source:      mount.Source,
			Options:     mount.Options,
			UIDMappings: nil,
			GIDMappings: nil,
		})
		createCmd = append(createCmd, "--volume", fmt.Sprintf("%s:%s%s", mount.Source, mount.Destination, ro))
		mountCount++
	}
	if mountCount == 0 && isTls {
		return rpt, errors.New("find zero volume while TLS is enabled")
	}

	if hostPorts, err := getCurrentPorts(current); err == nil {
		var ports []nettypes.PortMapping
		for _, hp := range hostPorts {
			ports = append(ports, nettypes.PortMapping{
				HostIP:        hp.ip,
				ContainerPort: 3876,
				HostPort:      hp.port,
				Protocol:      "tcp",
			})
			if hp.ip != "" {
				createCmd = append(createCmd, "--publish", fmt.Sprintf("%s:%d:%d", hp.ip, hp.port, 3876))
			} else {
				createCmd = append(createCmd, "--publish", fmt.Sprintf("%d:%d", hp.port, 3876))
			}
		}
		s.PortMappings = ports
	} else {
		return rpt, fmt.Errorf("cannot find published ports: %v", err)
	}

	resLimit := &spec.LinuxResources{}
	if cpuShares, cpuCores, err := getCurrentCpuLimit(current); err == nil {
		hasCpuLimit := false
		limitCpu := &spec.LinuxCPU{}
		if cpuShares > 0 {
			shares := cpuShares
			limitCpu.Shares = &shares
			hasCpuLimit = true
			createCmd = append(createCmd, "--cpu-shares", fmt.Sprintf("%d", cpuShares))

		}
		if cpuCores > 0 {
			period, quota := util.CoresToPeriodAndQuota(cpuCores)
			limitCpu.Period = &period
			limitCpu.Quota = &quota
			hasCpuLimit = true
			createCmd = append(createCmd, "--cpus", strconv.FormatFloat(cpuCores, 'f', -1, 64))
		}
		if hasCpuLimit {
			resLimit.CPU = limitCpu
		}
	} else {
		return rpt, fmt.Errorf("cannot get cpu limit: %v", err)
	}

	if mem, memSwap, err := getCurrentMemoryLimit(current); err == nil {
		hasMemoryLimit := false
		limitMem := &spec.LinuxMemory{}
		if mem > 0 {
			limitBytes := mem * 1024 * 1024
			limitMem.Limit = &limitBytes
			limitBytesDouble := limitBytes * 2
			limitMem.Swap = &limitBytesDouble
			hasMemoryLimit = true
			createCmd = append(createCmd, "--memory", fmt.Sprintf("%dm", mem))
		}
		if memSwap > 0 {
			limitBytes := memSwap * 1024 * 1024
			limitMem.Swap = &limitBytes
			hasMemoryLimit = true
			createCmd = append(createCmd, "--memory-swap", fmt.Sprintf("%dm", memSwap))
		}
		if hasMemoryLimit {
			resLimit.Memory = limitMem
		}
	} else {
		return rpt, fmt.Errorf("cannot get memory limit: %v", err)
	}

	if resLimit.CPU != nil || resLimit.Memory != nil {
		s.ResourceLimits = resLimit
	}

	s.RestartPolicy = "always"
	createCmd = append(createCmd, "--restart", "always")

	createCmd = append(createCmd, image)
	s.ContainerCreateCommand = createCmd

	log.Printf("Creating a new container")
	return adapter.ContainerCreateWithSpec(ctx, s, nil)
}

func getCurrentEnv(data *define.InspectContainerData, key string) string {
	for _, s := range data.Config.Env {
		for i := 0; i < len(s); i++ {
			if s[i] == '=' {
				if s[:i] == key {
					return s[i+1:]
				}
				continue
			}
		}
	}
	return ""
}

func getOtherVolumeMounts(data *define.InspectContainerData) []define.InspectMount {
	var ret []define.InspectMount
	for _, m := range data.Mounts {
		if m.Type == "bind" && m.Destination != system.URL_PODMAN && m.Driver == "" && m.Mode == "" {
			unsupported := false
			for _, opt := range m.Options {
				if opt != "rbind" {
					unsupported = true
					break
				}
			}
			if unsupported {
				break
			}
			ret = append(ret, m)
		}
	}
	return ret
}

type hostPort struct {
	ip   string
	port uint16
}

func getCurrentPorts(data *define.InspectContainerData) ([]hostPort, error) {
	ports, ok := data.NetworkSettings.Ports["3876/tcp"]
	if !ok {
		return nil, errors.New("key 3876/tcp not found")
	}
	// ports can be null. maybe the user accesses containerup from the container network

	ret := make([]hostPort, 0, len(ports))
	for _, p := range ports {
		port, err := strconv.ParseUint(p.HostPort, 10, 16)
		if err != nil {
			return nil, err
		}
		ret = append(ret, hostPort{ip: p.HostIP, port: uint16(port)})
	}
	return ret, nil
}

func getCurrentCpuLimit(data *define.InspectContainerData) (uint64, float64, error) {
	cpuShares := uint64(0)
	indexCpuShares := -1

	var err error
	cmds := data.Config.CreateCommand
	for i := 0; i < len(cmds); i++ {
		if cmds[i] == "--cpu-shares" {
			indexCpuShares = i + 1
		}
	}

	if indexCpuShares >= 0 {
		if indexCpuShares >= len(cmds) {
			return 0, 0, fmt.Errorf("incorrect indexCpuShares: %d", indexCpuShares)
		}
		cpuShares, err = strconv.ParseUint(cmds[indexCpuShares], 10, 64)
		if err != nil {
			return 0, 0, err
		}
	}

	cpuCores := float64(0)
	indexCpuCores := -1

	for i := 0; i < len(cmds); i++ {
		if cmds[i] == "--cpus" {
			indexCpuCores = i + 1
		}
	}

	if indexCpuCores >= 0 {
		if indexCpuCores >= len(cmds) {
			return 0, 0, fmt.Errorf("incorrect indexCpuCores: %d", indexCpuCores)
		}
		cpuCores, err = strconv.ParseFloat(cmds[indexCpuCores], 64)
		if err != nil {
			return 0, 0, err
		}
	}

	return cpuShares, cpuCores, nil
}

func getCurrentMemoryLimit(data *define.InspectContainerData) (int64, int64, error) {
	mem := int64(0)
	indexMem := -1

	var err error
	cmds := data.Config.CreateCommand
	for i := 0; i < len(cmds); i++ {
		if cmds[i] == "--memory" {
			indexMem = i + 1
		}
	}

	if indexMem >= 0 {
		if indexMem >= len(cmds) {
			return 0, 0, fmt.Errorf("incorrect indexMem: %d", indexMem)
		}

		memStr := cmds[indexMem]
		if memStr == "" || memStr[len(memStr)-1] != 'm' {
			return 0, 0, fmt.Errorf("unrecognized value: %s", memStr)
		}
		memStr = memStr[:len(memStr)-1]

		mem, err = strconv.ParseInt(memStr, 10, 64)
		if err != nil {
			return 0, 0, err
		}
	}

	memSwap := int64(0)
	indexMemSwap := -1

	for i := 0; i < len(cmds); i++ {
		if cmds[i] == "--memory-swap" {
			indexMemSwap = i + 1
		}
	}

	if indexMemSwap >= 0 {
		if indexMemSwap >= len(cmds) {
			return 0, 0, fmt.Errorf("incorrect indexMemSwap: %d", indexMemSwap)
		}

		memStr := cmds[indexMem]
		if memStr == "" || memStr[len(memStr)-1] != 'm' {
			return 0, 0, fmt.Errorf("unrecognized value: %s", memStr)
		}
		memStr = memStr[:len(memStr)-1]

		memSwap, err = strconv.ParseInt(memStr, 10, 64)
		if err != nil {
			return 0, 0, err
		}
	}

	return mem, memSwap, nil
}

func containerExec(ctx context.Context, nameOrId string, envs, cmds []string) (string, string, error) {
	sessionId, err := adapter.ContainerExecCreate(ctx, nameOrId, &handlers.ExecCreateConfig{ExecConfig: types.ExecConfig{
		Env:          envs,
		Cmd:          cmds,
		AttachStdout: true,
		AttachStderr: true,
	}})
	if err != nil {
		return "", "", fmt.Errorf("cannot create exec session: %v", err)
	}

	stdOutReader, stdOutWriter := io.Pipe()
	stdErrReader, stdErrWriter := io.Pipe()
	outputStdOut, outputStdErr := "", ""
	var err2, err3 error
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		var data []byte
		data, err2 = io.ReadAll(stdOutReader)
		outputStdOut = string(data)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		var data []byte
		data, err3 = io.ReadAll(stdErrReader)
		outputStdErr = string(data)
	}()

	opts := &containers.ExecStartAndAttachOptions{}
	opts.WithAttachOutput(true)
	opts.WithOutputStream(stdOutWriter)
	opts.WithAttachError(true)
	opts.WithErrorStream(stdErrWriter)

	err = adapter.ContainerExecStartAndAttach(ctx, sessionId, opts)
	if err != nil {
		return "", "", fmt.Errorf("cannot start exec session: %v", err)
	}
	stdOutWriter.Close()
	stdErrWriter.Close()
	wg.Wait()

	inspect, err := adapter.ContainerExecInspect(ctx, sessionId, nil)
	if err != nil {
		return "", "", fmt.Errorf("cannot inspect exec session: %v", err)
	}

	if inspect.ExitCode != 0 {
		return "", "", fmt.Errorf("exit code %d", inspect.ExitCode)
	}

	if err2 != nil || err3 != nil {
		return "", "", fmt.Errorf("cannot read outputStdOut: %v %v", err2, err3)
	}

	return outputStdOut, outputStdErr, nil
}
