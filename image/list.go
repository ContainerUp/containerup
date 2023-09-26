package image

import (
	"containerup/conn"
	"containerup/utils"
	"github.com/containers/podman/v4/pkg/bindings/images"
	"net/http"
	"sort"
)

func List(w http.ResponseWriter, req *http.Request) {
	pmConn := conn.GetConn(req.Context())

	ret, err := images.List(pmConn, nil)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

	sort.Slice(ret, func(i, j int) bool {
		return ret[i].Created > ret[j].Created
	})

	utils.Return(w, ret)
}
