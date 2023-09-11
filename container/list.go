package container

import (
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"net/http"
	"podmanman/conn"
	"podmanman/utils"
)

func List(w http.ResponseWriter, req *http.Request) {
	pmConn := conn.GetConn(req.Context())
	query := req.URL.Query()

	yes := true
	listOpts := &containers.ListOptions{
		All: &yes,
	}
	if query.Get("size") == "1" {
		listOpts.Size = &yes
	}

	ret, err := containers.List(pmConn, listOpts)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

	utils.Return(w, ret)
}
