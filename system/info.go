package system

import (
	"containerup/conn"
	"containerup/utils"
	"github.com/containers/podman/v4/pkg/bindings/system"
	"net/http"
)

func Info(w http.ResponseWriter, req *http.Request) {
	pmConn := conn.GetConn(req.Context())

	ret, err := system.Info(pmConn, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	utils.Return(w, ret)
}
