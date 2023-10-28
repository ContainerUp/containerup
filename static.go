package main

import (
	"containerup/utils"
	"embed"
	"github.com/gorilla/mux"
	"mime"
	"net/http"
	"path/filepath"
)

//go:embed web/build/*
var staticContents embed.FS

var spaPaths = []string{
	"/",
	"/overview",
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
	"/robots.txt",
	"/favicon.ico",
}

func handleFile(fileName string) func(http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, request *http.Request) {
		d, err := staticContents.ReadFile("web/build" + fileName)
		if err != nil {
			http.NotFound(writer, request)
			return
		}

		ct := mime.TypeByExtension(filepath.Ext(fileName))
		if ct != "" {
			// If no result is returned, http.DetectContentType will be used automatically, although it's inaccurate.
			writer.Header().Set("Content-Type", ct)
		}
		writer.Write(d)
	}
}

func registerStaticFiles(r *mux.Router) {
	r.PathPrefix("/static/").HandlerFunc(utils.ChainETag(func(w http.ResponseWriter, req *http.Request) {
		handleFile(req.URL.Path)(w, req)
	}, ""))

	for _, path := range spaPaths {
		r.HandleFunc(path, utils.ChainETag(handleFile("/index.html"), "/"))
	}

	for _, path := range staticFiles {
		r.HandleFunc(path, utils.ChainETag(handleFile(path), ""))
	}
}
