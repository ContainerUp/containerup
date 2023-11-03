package system

import (
	"containerup/adapter"
	"containerup/conn"
	"containerup/utils"
	"log"
	"net/http"
	"os"
)

type containerUpInfo struct {
	Version           string `json:"version"`
	CommitHash        string `json:"commit_hash"`
	BuildNum          string `json:"build_num"`
	ContainerHostname string `json:"container_hostname"`
}

type sysInfo struct {
	Podman      any              `json:"podman"`
	ContainerUp *containerUpInfo `json:"container_up"`
}

func Info(w http.ResponseWriter, req *http.Request) {
	pmConn := conn.GetConn(req.Context())

	ret, err := adapter.SystemInfo(pmConn, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	utils.Return(w, &sysInfo{
		Podman: ret,
		ContainerUp: &containerUpInfo{
			Version:           Version,
			CommitHash:        CommitHash,
			BuildNum:          BuildNum,
			ContainerHostname: ContainerHostname(),
		},
	})
}

func ContainerHostname() string {
	if env := os.Getenv("container"); env != "podman" {
		return ""
	}
	hn, err := os.Hostname()
	if err != nil {
		log.Printf("failed to get hostname: %v", err)
	}
	return hn
}
