package system

import (
	"github.com/containers/podman/v4/pkg/bindings/system"
	"net/http"
	"podmanman/conn"
	"podmanman/utils"
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
