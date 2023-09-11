package image

import (
	"fmt"
	"github.com/containers/podman/v4/pkg/bindings/images"
	"github.com/gorilla/mux"
	"net/http"
	"podmanman/conn"
	"podmanman/utils"
)

func Inspect(w http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)
	nameOrId := vars["name"]
	pmConn := conn.GetConn(req.Context())

	ret, err := images.GetImage(pmConn, nameOrId, nil)
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
