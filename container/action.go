package container

import (
	"containerup/adapter"
	"containerup/conn"
	"containerup/utils"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/gorilla/mux"
	"net/http"
	"strings"
)

var (
	errInvalidRepoTag = errors.New("invalid repo:tag value")
)

type action struct {
	Action  string `json:"action"`
	RepoTag string `json:"repoTag"`
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
	case "commit":
		err = commit(pmConn, nameOrId, act.RepoTag)
	default:
		http.Error(w, "unrecognized action", http.StatusBadRequest)
		return
	}

	if err != nil {
		if utils.IsErr404(err) {
			http.Error(w, "Cannot find such container", http.StatusNotFound)
			return
		}
		if errors.Is(err, errInvalidRepoTag) {
			http.Error(w, "Invalid repository[:tag] value", http.StatusBadRequest)
			return
		}
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
	return adapter.ContainerStop(ctx, nameOrID, stopOpts)
}

func start(ctx context.Context, nameOrID string) error {
	return adapter.ContainerStart(ctx, nameOrID, nil)
}

func remove(ctx context.Context, nameOrID string) error {
	sec := uint(20)
	removeOpts := &containers.RemoveOptions{
		Timeout: &sec,
	}
	results, err := adapter.ContainerRemove(ctx, nameOrID, removeOpts)
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

func commit(ctx context.Context, nameOrID, repoTag string) error {
	parts := strings.Split(repoTag, ":")
	if len(parts) == 0 || len(parts) > 2 {
		return errInvalidRepoTag
	}

	commitOpts := &containers.CommitOptions{
		Repo: &parts[0],
	}
	if len(parts) == 2 {
		commitOpts.Tag = &parts[1]
	}
	_, err := adapter.ContainerCommit(ctx, nameOrID, commitOpts)
	return err
}
