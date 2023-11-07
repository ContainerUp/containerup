package container

import (
	"containerup/adapter"
	"containerup/conn"
	"containerup/utils"
	"context"
	"encoding/json"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/gorilla/mux"
	"net/http"
)

type patchReq struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

func Patch(w http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)
	nameOrId := vars["name"]

	var act patchReq
	defer req.Body.Close()
	err := json.NewDecoder(req.Body).Decode(&act)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	pmConn := conn.GetConn(req.Context())

	switch act.Type {
	case "rename":
		name := ""
		err = json.Unmarshal(act.Data, &name)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		err = rename(pmConn, nameOrId, name)

	default:
		http.Error(w, "unrecognized patch type", http.StatusBadRequest)
		return
	}

	if err != nil {
		if utils.IsErr404(err) {
			http.Error(w, "Cannot find such container", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	utils.Return(w, true)
}

func rename(ctx context.Context, nameOrId, name string) error {
	opts := &containers.RenameOptions{Name: &name}
	return adapter.ContainerRename(ctx, nameOrId, opts)
}
