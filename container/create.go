package container

import (
	"containerup/conn"
	"containerup/utils"
	"encoding/json"
	"fmt"
	nettypes "github.com/containers/common/libnetwork/types"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/containers/podman/v4/pkg/specgen"
	"github.com/containers/podman/v4/pkg/util"
	"github.com/mattn/go-shellwords"
	spec "github.com/opencontainers/runtime-spec/specs-go"
	"net/http"
	"strconv"
)

type volumeReq struct {
	Container string `json:"container"`
	Host      string `json:"host"`
	ReadWrite string `json:"readWrite"`
}

type portReq struct {
	Container uint16   `json:"container"`
	Host      []uint16 `json:"host"`
	Protocol  string   `json:"protocol"`
}

type resReq struct {
	CpuShares        int     `json:"cpuShares"`
	CpuCores         float64 `json:"cpuCores"`
	MemoryMB         int     `json:"memoryMB"`
	MemoryWithSwapMB int     `json:"memorySwapMB"`
}

type createReq struct {
	Name          string            `json:"name"`
	Image         string            `json:"image"`
	Command       *string           `json:"command"`
	WorkDir       *string           `json:"workDir"`
	Env           map[string]string `json:"env"`
	Volumes       []*volumeReq      `json:"volumes"`
	Ports         []*portReq        `json:"ports"`
	Resources     *resReq           `json:"resources"`
	Start         bool              `json:"start"`
	AlwaysRestart bool              `json:"alwaysRestart"`
}

func Create(w http.ResponseWriter, req *http.Request) {
	var c createReq
	defer req.Body.Close()
	err := json.NewDecoder(req.Body).Decode(&c)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	pmConn := conn.GetConn(req.Context())

	createCmd := []string{"podman", "create"}
	if c.Start {
		createCmd = []string{"podman", "run", "-d"}
	}

	s := specgen.NewSpecGenerator(c.Image, false)
	s.Name = c.Name
	createCmd = append(createCmd, "--name", s.Name)

	if c.WorkDir != nil {
		s.WorkDir = *c.WorkDir
		createCmd = append(createCmd, "--workdir", s.WorkDir)
	}
	if len(c.Env) > 0 {
		s.Env = c.Env
		for k, v := range s.Env {
			createCmd = append(createCmd, "--env", fmt.Sprintf("%s=%s", k, v))
		}
	}
	if len(c.Volumes) > 0 {
		var mounts []spec.Mount
		for _, v := range c.Volumes {
			if v.ReadWrite != "ro" && v.ReadWrite != "rw" {
				http.Error(w, fmt.Sprintf("Invalid volume option: %s", v.ReadWrite), http.StatusBadRequest)
				return
			}

			mounts = append(mounts, spec.Mount{
				Destination: v.Container,
				Type:        "bind",
				Source:      v.Host,
				Options:     []string{v.ReadWrite},
			})
			createCmd = append(createCmd, "--volume", fmt.Sprintf("%s:%s:%s", v.Host, v.Container, v.ReadWrite))
		}
		s.Mounts = mounts
	}
	if len(c.Ports) > 0 {
		var ports []nettypes.PortMapping
		for _, p := range c.Ports {
			for _, hostPort := range p.Host {
				ports = append(ports, nettypes.PortMapping{
					ContainerPort: p.Container,
					HostPort:      hostPort,
					Protocol:      p.Protocol,
				})
				createCmd = append(createCmd, "--publish", fmt.Sprintf("%d:%d/%s", hostPort, p.Container, p.Protocol))
			}
		}
		s.PortMappings = ports
	}
	if res := c.Resources; res != nil {
		resLimit := &spec.LinuxResources{}

		hasCpuLimit := false
		limitCpu := &spec.LinuxCPU{}
		if res.CpuShares > 0 {
			shares := uint64(res.CpuShares)
			limitCpu.Shares = &shares
			hasCpuLimit = true
			resLimit.CPU = limitCpu
			createCmd = append(createCmd, "--cpu-shares", strconv.Itoa(res.CpuShares))
		}
		if res.CpuCores > 0 {
			period, quota := util.CoresToPeriodAndQuota(res.CpuCores)
			limitCpu.Period = &period
			limitCpu.Quota = &quota
			hasCpuLimit = true
			createCmd = append(createCmd, "--cpus", strconv.FormatFloat(res.CpuCores, 'f', -1, 64))
		}
		if hasCpuLimit {
			resLimit.CPU = limitCpu
		}

		hasMemoryLimit := false
		limitMem := &spec.LinuxMemory{}
		if res.MemoryMB > 0 {
			limitBytes := int64(res.MemoryMB) * 1024 * 1024
			limitMem.Limit = &limitBytes
			limitBytesDouble := limitBytes * 2
			limitMem.Swap = &limitBytesDouble
			hasMemoryLimit = true
			createCmd = append(createCmd, "--memory", fmt.Sprintf("%dm", res.MemoryMB))
		}
		if res.MemoryWithSwapMB > 0 {
			limitBytes := int64(res.MemoryWithSwapMB) * 1024 * 1024
			limitMem.Swap = &limitBytes
			hasMemoryLimit = true
			createCmd = append(createCmd, "--memory-swap", fmt.Sprintf("%dm", res.MemoryWithSwapMB))
		}
		if hasMemoryLimit {
			resLimit.Memory = limitMem
		}

		if hasCpuLimit || hasMemoryLimit {
			s.ResourceLimits = resLimit
		}
	}
	if c.AlwaysRestart {
		s.RestartPolicy = "always"
		createCmd = append(createCmd, "--restart", "always")
	}

	// finally, image and commands
	createCmd = append(createCmd, c.Image)

	if c.Command != nil {
		cmds, err := shellwords.Parse(*c.Command)
		if err != nil {
			http.Error(w, fmt.Sprintf("Invalid command: %v", err), http.StatusBadRequest)
			return
		}
		s.Command = cmds
		createCmd = append(createCmd, cmds...)
	}

	s.ContainerCreateCommand = createCmd
	ret, err := containers.CreateWithSpec(pmConn, s, nil)
	if err != nil {
		http.Error(w, fmt.Sprintf("Cannot create container: %v", err), http.StatusInternalServerError)
		return
	}

	startErrStr := ""
	if c.Start {
		err = containers.Start(pmConn, ret.ID, nil)
		if err != nil {
			startErrStr = err.Error()
		}
	}

	utils.Return(w, map[string]any{
		"Id":       ret.ID,
		"StartErr": startErrStr,
	})
}
