package container

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/gorilla/mux"
	"net/http"
	"podmanman/conn"
	"podmanman/utils"
	"strings"
)

type action struct {
	Action string `json:"action"`
}

func Action(w http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)
	nameOrId := vars["name"]

	var act action
	defer req.Body.Close()
	err := json.NewDecoder(req.Body).Decode(&act)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	pmConn := conn.GetConn(req.Context())

	switch act.Action {
	case "stop":
		err = stop(pmConn, nameOrId)
	case "start":
		err = start(pmConn, nameOrId)
	case "remove":
		err = remove(pmConn, nameOrId)
	default:
		http.Error(w, "unrecognized action", http.StatusBadRequest)
		return
	}

	if err != nil {
		// TODO 4xx errors
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	utils.Return(w, true)
}

func stop(ctx context.Context, nameOrID string) error {
	sec := uint(10)
	stopOpts := &containers.StopOptions{
		Timeout: &sec,
	}
	return containers.Stop(ctx, nameOrID, stopOpts)
}

func start(ctx context.Context, nameOrID string) error {
	return containers.Start(ctx, nameOrID, nil)
}

func remove(ctx context.Context, nameOrID string) error {
	sec := uint(20)
	removeOpts := &containers.RemoveOptions{
		Timeout: &sec,
	}
	results, err := containers.Remove(ctx, nameOrID, removeOpts)
	if err != nil {
		return err
	}

	var errStrs []string
	for _, r := range results {
		if r.Err != nil {
			errStrs = append(errStrs, fmt.Sprintf("%s: %v", r.Id, r.Err))
		}
	}

	if len(errStrs) > 0 {
		return errors.New(strings.Join(errStrs, "; "))
	}

	return nil
}
