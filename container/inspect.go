package container

import (
	"containerup/conn"
	"containerup/utils"
	"fmt"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/gorilla/mux"
	"net/http"
)

func Inspect(w http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)
	nameOrId := vars["name"]
	pmConn := conn.GetConn(req.Context())
	query := req.URL.Query()

	yes := true
	inspectOpts := &containers.InspectOptions{}
	if query.Get("size") == "1" {
		inspectOpts.Size = &yes
	}

	ret, err := containers.Inspect(pmConn, nameOrId, inspectOpts)
	if err != nil {
		if utils.IsErr404(err) {
			http.Error(w, fmt.Sprintf("Cannot find container %s", nameOrId), http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	utils.Return(w, ret)
}
