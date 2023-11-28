package main

import (
	"containerup/adapter"
	"containerup/conn"
	"containerup/container"
	"containerup/image"
	"containerup/login"
	"containerup/system"
	"containerup/update"
	"containerup/utils"
	"containerup/wsrouter"
	"context"
	"errors"
	"flag"
	"fmt"
	"github.com/gorilla/mux"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

var (
	fListen       = flag.String("listen", "127.0.0.1:3876", "Address and port to listen.")
	fPodman       = flag.String("podman", "unix:/run/podman/podman.sock", "`URL` of Podman.")
	vLegacy       = flag.Bool("v3", false, "Connect to Podman with a v3 legacy version.")
	fUsername     = flag.String("username", "podman", "The username to be used on the web.")
	fPasswordHash = flag.String("password-hash", "",
		"REQUIRED. The bcrypt hash of password to be used on the web. "+
			"Generate a password `hash` by using argument --generate-hash")
	fGenerateHash = flag.Bool("generate-hash", false,
		"Generate a hash from your password, then exit. "+
			"For security reasons, you have to input your password interactively.")
	fTlsCert = flag.String("tls-cert", "", "Path of TLS certificate")
	fTlsKey  = flag.String("tls-key", "", "Path of TLS key")
	fVersion = flag.Bool("version", false, "Show the version of ContainerUp, then exit.")
)

var (
	timeout       = 2 * time.Minute
	wsTimeout     = 60 * time.Minute
	wsLongTimeout = 8 * time.Hour
)

func main() {
	flag.Parse()
	if *fVersion {
		showVersion()
	}

	if *fGenerateHash {
		login.GenerateHash()
	}

	if val := os.Getenv("CONTAINERUP_UPDATE_PING"); val != "" {
		tls := false
		if v := os.Getenv("CONTAINERUP_UPDATE_TLS"); v != "" {
			tls = true
		}
		update.Ping(tls)
	}

	if *vLegacy {
		adapter.UseLegacy()
	}

	if val := os.Getenv("CONTAINER_UPDATE_RUN"); val != "" {
		update.Updater()
	}

	login.InitLogin(*fUsername, *fPasswordHash)

	chainConn, err := conn.ConnectionChainer(*fPodman)
	if err != nil {
		log.Fatalf("Cannot initialize connection to podman: %v", err)
	}

	r := mux.NewRouter()
	r.Use(utils.MiddlewareLogger)

	api := r.PathPrefix("/api").Subrouter()

	api.HandleFunc("/ping", update.Pong)
	api.HandleFunc("/login", chainLogin(timeout, login.Login)).Methods(http.MethodPost)
	api.HandleFunc("/logout", chainLogin(timeout, login.Logout)).Methods(http.MethodPost)

	api.HandleFunc("/container", chain(chainConn, timeout, container.List)).Methods(http.MethodGet)
	api.HandleFunc("/container", chain(chainConn, timeout, container.Create)).Methods(http.MethodPost)
	api.HandleFunc("/container/{name}/inspect", chain(chainConn, timeout, container.Inspect)).Methods(http.MethodGet)
	api.HandleFunc("/container/{name}/logs", chainWs(chainConn, wsTimeout, container.Logs)).Methods(http.MethodGet)
	api.HandleFunc("/container/{name}/exec", chainWs(chainConn, wsTimeout, container.Exec)).Methods(http.MethodGet)
	api.HandleFunc("/container/{name}", chain(chainConn, timeout, container.Action)).Methods(http.MethodPost)
	api.HandleFunc("/container/{name}", chain(chainConn, timeout, container.Patch)).Methods(http.MethodPatch)

	api.HandleFunc("/image", chain(chainConn, timeout, image.List)).Methods(http.MethodGet)
	api.HandleFunc("/image/pull", chainWs(chainConn, wsTimeout, image.Pull)).Methods(http.MethodGet)
	api.HandleFunc("/image/{name}/inspect", chain(chainConn, timeout, image.Inspect)).Methods(http.MethodGet)
	api.HandleFunc("/image/{name}", chain(chainConn, timeout, image.Action)).Methods(http.MethodPost)

	api.HandleFunc("/system/info", chain(chainConn, timeout, system.Info)).Methods(http.MethodGet)
	api.HandleFunc("/system/update", chain(chainConn, timeout, system.UpdateCheck)).Methods(http.MethodGet)
	api.HandleFunc("/system/update", chain(chainConn, timeout, system.UpdateAction)).Methods(http.MethodPost)

	api.HandleFunc("/subscribe", chainWs(chainConn, wsLongTimeout, wsrouter.Entry)).Methods(http.MethodGet)

	// static files
	registerStaticFiles(r)

	http.Handle("/", r)

	srv := http.Server{Addr: *fListen}

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		err := srv.Shutdown(ctx)
		log.Printf("shutdown: %v", err)
	}()

	if *fTlsCert != "" {
		system.IsTls = true
		err = srv.ListenAndServeTLS(*fTlsCert, *fTlsKey)
	} else {
		err = srv.ListenAndServe()
	}
	if !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("failed to listen: %v", err)
	}
}

func showVersion() {
	fmt.Printf("ContainerUp version %s commit %s build %s\n", system.Version, system.CommitHash, system.BuildNum)
	os.Exit(0)
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
