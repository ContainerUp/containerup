package main

import (
	"flag"
	"github.com/gorilla/mux"
	"log"
	"net/http"
	"podmanman/conn"
	"podmanman/container"
	"podmanman/image"
	"podmanman/login"
	"podmanman/system"
	"time"
)

var (
	fListen   = flag.String("listen", ":3876", "address to listen")
	fPodman   = flag.String("podman", "unix://run/podman/podman.sock", "uri of podman")
	fPassword = flag.String("password", "", "sha256 hashed password, generate using command `echo -n \"username:password\" | sha256sum`")
)

var (
	timeout   = 2 * time.Minute
	wsTimeout = 60 * time.Minute
)

func main() {
	flag.Parse()
	login.InitPassword(*fPassword)
	conn.InitUri(*fPodman)

	go system.GetEvents(*fPodman)

	r := mux.NewRouter()
	s := r.PathPrefix("/api").Subrouter()

	s.HandleFunc("/login", login.Login).Methods(http.MethodPost)

	s.HandleFunc("/container", login.Guard(conn.Connection(container.List, timeout))).Methods(http.MethodGet)
	s.HandleFunc("/container", login.Guard(conn.Connection(container.Create, timeout))).Methods(http.MethodPost)
	s.HandleFunc("/container/{name}/inspect", login.Guard(conn.Connection(container.Inspect, timeout))).Methods(http.MethodGet)
	s.HandleFunc("/container/{name}/logs", conn.Connection(container.Logs, wsTimeout)).Methods(http.MethodGet)
	s.HandleFunc("/container/{name}/exec", conn.Connection(container.Exec, wsTimeout)).Methods(http.MethodGet)
	s.HandleFunc("/container/{name}", login.Guard(conn.Connection(container.Action, timeout))).Methods(http.MethodPost)

	s.HandleFunc("/image", login.Guard(conn.Connection(image.List, timeout))).Methods(http.MethodGet)
	s.HandleFunc("/image/pull", conn.Connection(image.Pull, wsTimeout)).Methods(http.MethodGet)
	s.HandleFunc("/image/{name}/inspect", login.Guard(conn.Connection(image.Inspect, timeout))).Methods(http.MethodGet)
	s.HandleFunc("/image/{name}", login.Guard(conn.Connection(image.Action, timeout))).Methods(http.MethodPost)

	s.HandleFunc("/system/info", login.Guard(conn.Connection(system.Info, timeout))).Methods(http.MethodGet)

	// static files
	registerStaticFiles(r)

	http.Handle("/", r)
	err := http.ListenAndServe(*fListen, nil)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}
}
