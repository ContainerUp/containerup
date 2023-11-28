package system

import (
	"containerup/adapter"
	"containerup/conn"
	"containerup/utils"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/containers/podman/v4/libpod/define"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/containers/podman/v4/pkg/specgen"
	spec "github.com/opencontainers/runtime-spec/specs-go"
	"net/http"
	"os"
	"strings"
	"time"
)

type updateCheckResp struct {
	OK      bool   `json:"ok"`
	Message string `json:"message"`
}

func UpdateCheck(w http.ResponseWriter, req *http.Request) {
	pmConn := conn.GetConn(req.Context())
	_, err := updateCheck(pmConn, false)
	if err != nil {
		utils.Return(w, &updateCheckResp{
			OK:      false,
			Message: err.Error(),
		})
		return
	}
	utils.Return(w, &updateCheckResp{
		OK: true,
	})
}

func updateCheck(ctx context.Context, inspect bool) (*define.InspectContainerData, error) {
	if env := os.Getenv("container"); env != "podman" {
		return nil, errors.New("not running in a container")
	}
	hn, err := os.Hostname()
	if err != nil {
		return nil, fmt.Errorf("failed to get hostname: %v", err)
	}

	if hn == "" {
		return nil, errors.New("empty hostname")
	}

	ctns, err := adapter.ContainerList(ctx, (&containers.ListOptions{}).WithAll(true))
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %v", err)
	}

	ctnupName := ""
	namesMap := map[string]bool{}
	for _, ctn := range ctns {
		if ctn.ID[0:12] == hn && len(ctn.Names) > 0 {
			ctnupName = ctn.Names[0]
		}
		if len(ctn.Names) > 0 {
			namesMap[ctn.Names[0]] = true
		}
	}
	if ctnupName == "" {
		return nil, fmt.Errorf("failed to find container %s", hn)
	}

	blockNames := []string{ctnupName + "-updater", ctnupName + "-old", ctnupName + "-update-failure"}
	for _, n := range blockNames {
		if namesMap[n] {
			blkStr := strings.Join(blockNames, ", ")
			return nil, fmt.Errorf("container named `%s` exists. make sure these containers are removed: %s", n, blkStr)
		}
	}

	if !inspect {
		return nil, nil
	}
	containerData, err := adapter.ContainerInspect(ctx, hn, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect container: %v", err)
	}

	return containerData, nil
}

type updateActionReq struct {
	Image string `json:"image"`
}

func UpdateAction(w http.ResponseWriter, req *http.Request) {
	var act updateActionReq
	defer req.Body.Close()
	err := json.NewDecoder(req.Body).Decode(&act)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	pmConn := conn.GetConn(req.Context())
	inspect, err := updateCheck(pmConn, true)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	updaterId, err := createUpdater(pmConn, act.Image, inspect)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	err = adapter.ContainerStart(pmConn, updaterId, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	time.Sleep(2 * time.Second)
	inspectUpdater, err := adapter.ContainerInspect(pmConn, updaterId, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if !inspectUpdater.State.Running {
		str := fmt.Sprintf("updater not running, status %s exit_code %d", inspectUpdater.State.Status, inspectUpdater.State.ExitCode)
		http.Error(w, str, http.StatusInternalServerError)
	}

	utils.Return(w, true)
}

func createUpdater(ctx context.Context, image string, inspect *define.InspectContainerData) (string, error) {
	createCmd := []string{"podman", "run", "-d"}

	s := specgen.NewSpecGenerator(image, false)
	s.Name = inspect.Name + "-updater"
	createCmd = append(createCmd, "--name", s.Name)

	s.Env = map[string]string{
		ENV_UPDATE_RUN:        "1",
		ENV_UPDATE_IMAGE:      image,
		ENV_UPDATE_CURRENT_ID: inspect.ID,
	}
	createCmd = append(createCmd, "--env", fmt.Sprintf("%s=%s", ENV_UPDATE_RUN, "1"))
	createCmd = append(createCmd, "--env", fmt.Sprintf("%s=%s", ENV_UPDATE_IMAGE, image))
	createCmd = append(createCmd, "--env", fmt.Sprintf("%s=%s", ENV_UPDATE_CURRENT_ID, inspect.ID))

	if IsTls {
		s.Env[ENV_UPDATE_TLS] = "1"
		createCmd = append(createCmd, "--env", fmt.Sprintf("%s=%s", ENV_UPDATE_TLS, "1"))
	}

	if adapter.IsUsingLegacy() {
		s.Env[ENV_PODMAN_V3] = "1"
		createCmd = append(createCmd, "--env", fmt.Sprintf("%s=%s", ENV_PODMAN_V3, "1"))
	}

	if src := GetCurrentVolumePodmanURL(inspect); src != "" {
		s.Mounts = []spec.Mount{{
			Destination: URL_PODMAN,
			Type:        "bind",
			Source:      src,
		}}
		createCmd = append(createCmd, "--volume", fmt.Sprintf("%s:%s", src, URL_PODMAN))
	} else {
		return "", errors.New("cannot find URL of Podman")
	}

	createCmd = append(createCmd, image)
	s.ContainerCreateCommand = createCmd

	resp, err := adapter.ContainerCreateWithSpec(ctx, s, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create container: %v", err)
	}
	return resp.ID, nil
}

const (
	ENV_UPDATE_RUN        = "CONTAINER_UPDATE_RUN"
	ENV_UPDATE_IMAGE      = "CONTAINERUP_UPDATE_IMAGE"
	ENV_UPDATE_CURRENT_ID = "CONTAINERUP_UPDATE_CURRENT_ID"
	ENV_UPDATE_TLS        = "CONTAINERUP_UPDATE_TLS"
)

const (
	ENV_USERNAME      = "CONTAINERUP_USERNAME"
	ENV_PASSWORD_HASH = "CONTAINERUP_PASSWORD_HASH"
	ENV_PODMAN_V3     = "CONTAINERUP_PODMAN_V3"

	URL_PODMAN = "/run/podman/podman.sock"
)

func GetCurrentVolumePodmanURL(data *define.InspectContainerData) string {
	for _, m := range data.Mounts {
		if m.Type == "bind" && m.Destination == URL_PODMAN {
			return m.Source
		}
	}
	return ""
}
