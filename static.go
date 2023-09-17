package main

import (
	"embed"
	"github.com/gorilla/mux"
	"io/fs"
	"net/http"
)

//go:embed web/*
var staticContents embed.FS

var spaPaths = []string{
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

var staticFiles = []string{
	"robots.txt",
	"favicon.png",
}

func handleFile(fileName string) func(http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, request *http.Request) {
		d, err := staticContents.ReadFile("web/" + fileName)
		if err != nil {
			http.NotFound(writer, request)
			return
		}
		writer.Write(d)
	}
}

func registerStaticFiles(r *mux.Router) {
	sub, err := fs.Sub(staticContents, "web")
	if err != nil {
		panic(err)
	}

	r.PathPrefix("/static/").Handler(http.FileServer(http.FS(sub)))

	for _, path := range spaPaths {
		r.HandleFunc(path, handleFile("index.html"))
	}

	for _, path := range staticFiles {
		r.HandleFunc("/"+path, handleFile(path))
	}
}
