package main

import (
	"containerup/conn"
	"containerup/container"
	"containerup/image"
	"containerup/login"
	"containerup/system"
	"containerup/wsrouter"
	"flag"
	"github.com/gorilla/mux"
	"log"
	"net/http"
	"time"
)

var (
	fListen   = flag.String("listen", ":3876", "address to listen")
	fPodman   = flag.String("podman", "unix://run/podman/podman.sock", "uri of podman")
	fPassword = flag.String("password", "", "sha256 hashed password, generate using command `echo -n \"username:password\" | sha256sum`")
)

var (
	timeout       = 2 * time.Minute
	wsTimeout     = 60 * time.Minute
	wsLongTimeout = 8 * time.Hour
)

func main() {
	flag.Parse()
	login.InitPassword(*fPassword)
	conn.InitUri(*fPodman)

	r := mux.NewRouter()
	api := r.PathPrefix("/api").Subrouter()

	api.HandleFunc("/login", login.Login).Methods(http.MethodPost)

	api.HandleFunc("/container", login.Guard(conn.Connection(container.List, timeout))).Methods(http.MethodGet)
	api.HandleFunc("/container", login.Guard(conn.Connection(container.Create, timeout))).Methods(http.MethodPost)
	api.HandleFunc("/container/{name}/inspect", login.Guard(conn.Connection(container.Inspect, timeout))).Methods(http.MethodGet)
	api.HandleFunc("/container/{name}/logs", conn.Connection(container.Logs, wsTimeout)).Methods(http.MethodGet)
	api.HandleFunc("/container/{name}/exec", conn.Connection(container.Exec, wsTimeout)).Methods(http.MethodGet)
	api.HandleFunc("/container/{name}", login.Guard(conn.Connection(container.Action, timeout))).Methods(http.MethodPost)

	api.HandleFunc("/image", login.Guard(conn.Connection(image.List, timeout))).Methods(http.MethodGet)
	api.HandleFunc("/image/pull", conn.Connection(image.Pull, wsTimeout)).Methods(http.MethodGet)
	api.HandleFunc("/image/{name}/inspect", login.Guard(conn.Connection(image.Inspect, timeout))).Methods(http.MethodGet)
	api.HandleFunc("/image/{name}", login.Guard(conn.Connection(image.Action, timeout))).Methods(http.MethodPost)

	api.HandleFunc("/system/info", login.Guard(conn.Connection(system.Info, timeout))).Methods(http.MethodGet)
	api.HandleFunc("/system/events", conn.Connection(system.Events, wsTimeout)).Methods(http.MethodGet)

	api.HandleFunc("/subscribe", conn.Connection(wsrouter.Entry, wsLongTimeout)).Methods(http.MethodGet)

	// static files
	registerStaticFiles(r)

	http.Handle("/", r)
	err := http.ListenAndServe(*fListen, nil)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}
}
