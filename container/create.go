package container

import (
	"containerup/conn"
	"containerup/utils"
	"encoding/json"
	"fmt"
	nettypes "github.com/containers/common/libnetwork/types"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/containers/podman/v4/pkg/specgen"
	"github.com/mattn/go-shellwords"
	spec "github.com/opencontainers/runtime-spec/specs-go"
	"net/http"
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

type createReq struct {
	Name    string            `json:"name"`
	Image   string            `json:"image"`
	Command string            `json:"command"`
	WorkDir string            `json:"workDir"`
	Env     map[string]string `json:"env"`
	Volumes []*volumeReq      `json:"volumes"`
	Ports   []*portReq        `json:"ports"`
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

	createCmd := []string{"podman", "run", "-d"}
	s := specgen.NewSpecGenerator(c.Image, false)
	s.Name = c.Name
	createCmd = append(createCmd, "--name", s.Name)

	if c.WorkDir != "" {
		s.WorkDir = c.WorkDir
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
				createCmd = append(createCmd, "--publish", fmt.Sprintf("%d:%d/%s", p.Host, p.Container, p.Protocol))
			}
		}
		s.PortMappings = ports
	}

	createCmd = append(createCmd, c.Image)

	if c.Command != "" {
		cmds, err := shellwords.Parse(c.Command)
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

	_ = containers.Start(pmConn, ret.ID, nil)

	utils.Return(w, ret)
}
