package main

import (
	"embed"
	"github.com/gorilla/mux"
	"net/http"
)

//go:embed web
var staticContents embed.FS

var staticPaths = []string{
	"/",
	"/containers",
	"/containers/{any:.+}",
	"/containers_create",
	"/images",
	"/images/{any:.+}",
	"/info",
	"/login",
	"/logout",
}

func handleIndex(writer http.ResponseWriter, request *http.Request) {
	d, _ := staticContents.ReadFile("index.html")
	writer.Write(d)
}

func registerStaticFiles(r *mux.Router) {
	r.PathPrefix("/static/").Handler(http.FileServer(http.FS(staticContents)))

	for _, path := range staticPaths {
		r.HandleFunc(path, handleIndex)
	}
}
