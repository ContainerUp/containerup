package image

import (
	"containerup/adapter"
	"containerup/conn"
	"containerup/utils"
	"fmt"
	"github.com/gorilla/mux"
	"net/http"
)

func Inspect(w http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)
	nameOrId := vars["name"]
	pmConn := conn.GetConn(req.Context())

	ret, err := adapter.ImageGet(pmConn, nameOrId, nil)
	if err != nil {
		if utils.IsErr404(err) {
			http.Error(w, fmt.Sprintf("Cannot find image %s", nameOrId), http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	utils.Return(w, ret)
}
