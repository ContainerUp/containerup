package image

import (
	"github.com/containers/podman/v4/pkg/bindings/images"
	"net/http"
	"podmanman/conn"
	"podmanman/utils"
	"sort"
)

func List(w http.ResponseWriter, req *http.Request) {
	pmConn := conn.GetConn(req.Context())

	yes := true
	listOpts := &images.ListOptions{
		All: &yes,
	}
	ret, err := images.List(pmConn, listOpts)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

	sort.Slice(ret, func(i, j int) bool {
		return ret[i].Created > ret[j].Created
	})

	utils.Return(w, ret)
}
