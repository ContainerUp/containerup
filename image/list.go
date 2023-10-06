package image

import (
	"containerup/adapter"
	"containerup/conn"
	"containerup/utils"
	"net/http"
	"sort"
)

func List(w http.ResponseWriter, req *http.Request) {
	pmConn := conn.GetConn(req.Context())

	ret, err := adapter.ImageList(pmConn, nil)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

	sort.Slice(ret, func(i, j int) bool {
		return ret[i].Created > ret[j].Created
	})

	utils.Return(w, ret)
}
