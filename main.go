package main

import (
	"containerup/conn"
	"containerup/container"
	"containerup/image"
	"containerup/login"
	"containerup/system"
	"containerup/utils"
	"containerup/wsrouter"
	"flag"
	"github.com/gorilla/mux"
	"log"
	"net/http"
	"time"
)

var (
	fListen   = flag.String("listen", "127.0.0.1:3876", "address to listen")
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

	chainConn, err := conn.ConnectionChainer(*fPodman)
	if err != nil {
		log.Fatalf("Cannot initialize connection to podman: %v", err)
	}

	r := mux.NewRouter()
	r.Use(utils.MiddlewareLogger)

	api := r.PathPrefix("/api").Subrouter()

	api.HandleFunc("/login", chainLogin(timeout, login.Login)).Methods(http.MethodPost)

	api.HandleFunc("/container", chain(chainConn, timeout, container.List)).Methods(http.MethodGet)
	api.HandleFunc("/container", chain(chainConn, timeout, container.Create)).Methods(http.MethodPost)
	api.HandleFunc("/container/{name}/inspect", chain(chainConn, timeout, container.Inspect)).Methods(http.MethodGet)
	api.HandleFunc("/container/{name}/logs", chainWs(chainConn, wsTimeout, container.Logs)).Methods(http.MethodGet)
	api.HandleFunc("/container/{name}/exec", chainWs(chainConn, wsTimeout, container.Exec)).Methods(http.MethodGet)
	api.HandleFunc("/container/{name}", chain(chainConn, timeout, container.Action)).Methods(http.MethodPost)

	api.HandleFunc("/image", chain(chainConn, timeout, image.List)).Methods(http.MethodGet)
	api.HandleFunc("/image/pull", chainWs(chainConn, wsTimeout, image.Pull)).Methods(http.MethodGet)
	api.HandleFunc("/image/{name}/inspect", chain(chainConn, timeout, image.Inspect)).Methods(http.MethodGet)
	api.HandleFunc("/image/{name}", chain(chainConn, timeout, image.Action)).Methods(http.MethodPost)

	api.HandleFunc("/system/info", chain(chainConn, timeout, system.Info)).Methods(http.MethodGet)
	//api.HandleFunc("/system/events", conn.Connection(system.Events, wsTimeout)).Methods(http.MethodGet)

	api.HandleFunc("/subscribe", chainWs(chainConn, wsLongTimeout, wsrouter.Entry)).Methods(http.MethodGet)

	// static files
	registerStaticFiles(r)

	http.Handle("/", r)
	err = http.ListenAndServe(*fListen, nil)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}
}

func chainLogin(timeout time.Duration, next http.HandlerFunc) http.HandlerFunc {
	return utils.ChainTimeoutCtx(next, timeout)
}

func chain(connChain func(http.HandlerFunc) http.HandlerFunc, timeout time.Duration, next http.HandlerFunc) http.HandlerFunc {
	if connChain != nil {
		next = connChain(next)
	}
	return utils.ChainTimeoutCtx(login.Guard(next), timeout)
}

func chainWs(connChain func(http.HandlerFunc) http.HandlerFunc, timeout time.Duration, next http.HandlerFunc) http.HandlerFunc {
	return utils.ChainTimeoutCtx(connChain(next), timeout)
}
