package container

import (
	"containerup/conn"
	"containerup/login"
	"containerup/utils"
	"context"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"sync"
)

var (
	upgrader = websocket.Upgrader{}
)

func Logs(w http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)
	nameOrId := vars["name"]
	pmConn := conn.GetConn(req.Context())

	yes := true
	logOptions := &containers.LogOptions{
		Stdout: &yes,
		Stderr: &yes,
	}
	if req.URL.Query().Get("follow") == "1" {
		t := true
		logOptions.Follow = &t
	}
	if t := req.URL.Query().Get("tail"); t != "" {
		logOptions.Tail = &t
	}

	ws, err := upgrader.Upgrade(w, req, nil)
	if err != nil {
		// err replied in upgrader.Upgrade
		return
	}

	if !login.WebsocketAuth(ws) {
		return
	}

	//log.Printf("logs start...")
	//defer log.Printf("logs end")

	pmConn, stopByServer, waitEnd, chStdOut, chStdErr := logsSender(pmConn, ws)

	err = containers.Logs(pmConn, nameOrId, logOptions, chStdOut, chStdErr)
	stopByServer(err)

	waitEnd()
}

func logsSender(pmConn context.Context, ws *websocket.Conn) (context.Context, func(error), func(), chan string, chan string) {
	pmConn, cancel := context.WithCancel(pmConn)

	var wgWsReader, wgWsWriter, wgOutputReader sync.WaitGroup

	chWrite := make(chan string)
	chStdOut := make(chan string)
	chStdErr := make(chan string)

	waitEnd := func() {
		wgOutputReader.Wait() // redundant
		wgWsWriter.Wait()     // redundant
		wgWsReader.Wait()
		cancel() // redundant
	}

	stopByServer := func(err error) {
		close(chStdOut)
		close(chStdErr)
		wgOutputReader.Wait()
		close(chWrite)
		wgWsWriter.Wait()

		wsCode := websocket.CloseNormalClosure
		text := ""
		if err != nil {
			wsCode = websocket.CloseInternalServerErr
			text = err.Error()
		}
		err = ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(wsCode, text))
		if err != nil && utils.IsWsCloseMsgTooLong(err) {
			// error msg is too long to be sent in closeMsg
			//ws.WriteMessage(websocket.TextMessage, []byte("e"+text)) // not yet implemented in the front-end
			ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(wsCode, ""))
		}
	}

	stopByClient := func(err error) {
		if err != nil {
			ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseInternalServerErr, err.Error()))
		}
		cancel()
	}

	ws.SetCloseHandler(func(code int, text string) error {
		//log.Printf("log ws client close: %d %s", code, text)
		_ = ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(code, ""))
		stopByClient(nil)
		return nil
	})

	// empty read
	wgWsReader.Add(1)
	go func() {
		defer wgWsReader.Done()

		var err error
		for err == nil {
			_, _, err = ws.ReadMessage()
		}
		//log.Printf("ws reader err: %v", err)
	}()

	wgWsWriter.Add(1)
	go func() {
		defer wgWsWriter.Done()

		var err error
		for msg := range chWrite {
			err = ws.WriteMessage(websocket.TextMessage, []byte(msg))
			if err != nil {
				log.Printf("ws write err: %v", err)
				break
			}
		}
		stopByClient(err)
	}()

	wgOutputReader.Add(1)
	go func() {
		defer wgOutputReader.Done()

		for msg := range chStdOut {
			chWrite <- "1" + msg
		}
	}()

	wgOutputReader.Add(1)
	go func() {
		defer wgOutputReader.Done()

		for msg := range chStdErr {
			chWrite <- "2" + msg
		}
	}()

	return pmConn, stopByServer, waitEnd, chStdOut, chStdErr
}
