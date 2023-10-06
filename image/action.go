package image

import (
	"containerup/adapter"
	"containerup/conn"
	"containerup/utils"
	"context"
	"encoding/json"
	"errors"
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
	imageId := vars["name"]

	var act action
	defer req.Body.Close()
	err := json.NewDecoder(req.Body).Decode(&act)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	pmConn := conn.GetConn(req.Context())

	ret := any(true)
	switch act.Action {
	case "remove":
		ret, err = remove(pmConn, imageId, act.RepoTag)
	case "tag":
		err = tag(pmConn, imageId, act.RepoTag)
	default:
		http.Error(w, "unrecognized action", http.StatusBadRequest)
		return
	}

	if err != nil {
		if utils.IsErr404(err) {
			http.Error(w, "Cannot find such image", http.StatusNotFound)
			return
		}
		if errors.Is(err, errInvalidRepoTag) {
			http.Error(w, "Invalid repository[:tag] value", http.StatusBadRequest)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	utils.Return(w, ret)
}

func remove(ctx context.Context, nameOrID, tag string) (any, error) {
	if tag != "" {
		nameOrID = tag
	}

	ret, errs := adapter.ImageRemove(ctx, []string{nameOrID}, nil)
	if len(errs) > 0 {
		errStr := ""
		for _, e := range errs {
			errStr += e.Error()
		}
		return "", errors.New(errStr)
	}

	result := "untagged"
	if len(ret.Deleted) > 0 {
		result = "removed"
	}

	return result, nil
}

func tag(ctx context.Context, nameOrId, repoTag string) error {
	parts := strings.Split(repoTag, ":")
	if len(parts) == 0 || len(parts) > 2 {
		return errInvalidRepoTag
	}

	tag := ""
	if len(parts) == 2 {
		tag = parts[1]
	}

	return adapter.ImageTag(ctx, nameOrId, tag, parts[0], nil)
}
