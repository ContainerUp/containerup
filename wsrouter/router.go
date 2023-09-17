package wsrouter

import (
	"containerup/conn"
	"containerup/container"
	"containerup/image"
	"containerup/login"
	"containerup/wstypes"
	"context"
	"github.com/gorilla/websocket"
	"net/http"
	"sync"
)

var (
	upgrader = websocket.Upgrader{}
)

func Entry(w http.ResponseWriter, req *http.Request) {
	ws, err := upgrader.Upgrade(w, req, nil)
	if err != nil {
		// err replied in upgrader
		return
	}

	if !login.WebsocketAuth(ws) {
		return
	}

	var wgReader, wgWriter, subWg sync.WaitGroup
	wsWriter := make(chan *wstypes.WsRespMessage)

	pmConn := conn.GetConn(req.Context())
	ctx, cancel := context.WithCancel(pmConn)
	defer cancel()

	wgReader.Add(1)
	go func() {
		defer wgReader.Done()
		defer subWg.Wait()

		for {
			msg := &wstypes.WsReqMessage{}
			err := ws.ReadJSON(msg)
			if err != nil {
				cancel()
				break
			}

			if ctx.Err() != nil {
				// ctx cancelled, ws read should fail then
				continue
			}

			// handle msg
			subWg.Add(1)
			go func() {
				defer subWg.Done()
				router(ctx, msg, wsWriter)
			}()
		}
	}()

	wgWriter.Add(1)
	go func() {
		defer wgWriter.Done()

		for {
			end := false
			select {
			case <-ctx.Done():
				end = true
			case msg, ok := <-wsWriter:
				if !ok {
					end = true
					break
				}
				err := ws.WriteJSON(msg)
				if err != nil {
					end = true
				}
			}

			if end {
				go func() {
					// drop all ws messages to send
					for range wsWriter {
					}
				}()
				break
			}
		}
	}()

	wgReader.Wait()
	close(wsWriter)
	wgWriter.Wait()
}

func router(ctx context.Context, msg *wstypes.WsReqMessage, writer chan<- *wstypes.WsRespMessage) {
	switch msg.Action {
	case "subscribeToContainersList":
		container.SubscribeToContainersList(ctx, msg, writer)
	case "unsubscribeToContainersList":
		container.UnsubscribeToContainersList(ctx, msg, writer)
	case "subscribeToContainer":
		container.SubscribeToContainer(ctx, msg, writer)
	case "unsubscribeToContainer":
		container.UnsubscribeToContainer(ctx, msg, writer)
	case "subscribeToImagesList":
		image.SubscribeToImagesList(ctx, msg, writer)
	case "unsubscribeToImagesList":
		image.UnsubscribeToImagesList(ctx, msg, writer)
	default:
		notFound(ctx, msg, writer)
	}
}

func notFound(ctx context.Context, msg *wstypes.WsReqMessage, writer chan<- *wstypes.WsRespMessage) {
	writer <- &wstypes.WsRespMessage{
		Index: msg.Index,
		Error: true,
		Data:  "invalid action",
	}
}
