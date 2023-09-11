package image

import (
	"context"
	"github.com/containers/podman/v4/pkg/bindings/images"
	"github.com/gorilla/websocket"
	"io"
	"log"
	"net/http"
	"podmanman/conn"
	"podmanman/login"
	"podmanman/utils"
	"sync"
)

var (
	upgrader = websocket.Upgrader{}
)

func Pull(w http.ResponseWriter, req *http.Request) {
	imgName := req.URL.Query().Get("name")
	if imgName == "" {
		http.Error(w, "image name is not specified", http.StatusBadRequest)
		return
	}

	pmConn := conn.GetConn(req.Context())
	progressReader, progressWriter := io.Pipe()

	pullOpts := &images.PullOptions{}
	pullOpts.WithProgressWriter(progressWriter)

	ws, err := upgrader.Upgrade(w, req, nil)
	if err != nil {
		// err replied in upgrader.Upgrade
		return
	}

	if !login.WebsocketAuth(ws) {
		return
	}

	//log.Printf("image pull start...")
	//defer log.Printf("image pull end")

	pmConn, stopByServer, waitEnd := pullStatusTransmitter(pmConn, ws, progressReader)

	imgs, err := images.Pull(pmConn, imgName, pullOpts)
	stopByServer(imgs, err)
	waitEnd()
}

func pullStatusTransmitter(pmConn context.Context, ws *websocket.Conn, progressReader io.ReadCloser) (context.Context, func([]string, error), func()) {
	pmConn, cancel := context.WithCancel(pmConn)

	var wgWsReader, wgWsWriter, wgOutputReader sync.WaitGroup

	chWrite := make(chan []byte)

	waitEnd := func() {
		wgOutputReader.Wait() // redundant
		wgWsWriter.Wait()     // redundant
		wgWsReader.Wait()
		cancel() // redundant
	}

	stopByServer := func(imgs []string, err error) {
		// we have to close the pipes
		progressReader.Close()

		wgOutputReader.Wait()
		close(chWrite)
		wgWsWriter.Wait()

		if len(imgs) > 0 {
			// the image successfully pulled
			ws.WriteMessage(websocket.TextMessage, []byte("s"+imgs[0]))
		}

		wsCode := websocket.CloseNormalClosure
		text := ""
		if err != nil {
			wsCode = 4000
			text = err.Error()
		}
		err = ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(wsCode, text))
		if err != nil && utils.IsWsCloseMsgTooLong(err) {
			// error msg is too long to be sent in closeMsg
			ws.WriteMessage(websocket.TextMessage, []byte("e"+text))
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
		_ = ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(code, ""))
		stopByClient(nil)
		return nil
	})

	// empty reader
	go func() {
		wgWsReader.Add(1)
		defer wgWsReader.Done()

		var err error
		for err == nil {
			_, _, err = ws.ReadMessage()
		}
	}()

	go func() {
		wgWsWriter.Add(1)
		defer wgWsWriter.Done()

		var err error
		for msg := range chWrite {
			err = ws.WriteMessage(websocket.TextMessage, msg)
			if err != nil {
				log.Printf("ws write err: %v", err)
				break
			}
		}
		stopByClient(err)
	}()

	go func() {
		wgOutputReader.Add(1)
		defer wgOutputReader.Done()

		var err error
		var n int
		for {
			buf := make([]byte, 1025)
			buf[0] = '0'
			n, err = progressReader.Read(buf[1:])
			if n > 0 {
				chWrite <- buf[:n+1]
			}
			if err != nil {
				break
			}
		}
	}()

	return pmConn, stopByServer, waitEnd
}
