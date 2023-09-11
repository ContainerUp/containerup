package image

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/containers/podman/v4/pkg/bindings/images"
	"github.com/gorilla/mux"
	"net/http"
	"podmanman/conn"
	"podmanman/utils"
	"strings"
)

type action struct {
	Action  string `json:"action"`
	RepoTag string `json:"repoTag"`
}

func Action(w http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)
	imageId := vars["name"]

	var act action
	defer req.Body.Close()
	err := json.NewDecoder(req.Body).Decode(&act)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	pmConn := conn.GetConn(req.Context())

	switch act.Action {
	case "remove":
		err = remove(pmConn, imageId, act.RepoTag)
	case "tag":
		err = tag(pmConn, imageId, act.RepoTag)
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

func remove(ctx context.Context, nameOrID, tag string) error {
	if tag != "" {
		nameOrID = tag
	}

	_, errs := images.Remove(ctx, []string{nameOrID}, nil)
	if len(errs) > 0 {
		errStr := ""
		for _, e := range errs {
			errStr += e.Error()
		}
		return errors.New(errStr)
	}

	return nil
}

func tag(ctx context.Context, nameOrId, repoTag string) error {
	parts := strings.Split(repoTag, ":")
	if len(parts) != 2 {
		return errors.New("invalid repo:tag value")
	}

	return images.Tag(ctx, nameOrId, parts[1], parts[0], nil)
}
