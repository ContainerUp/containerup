package system

import (
	"containerup/conn"
	"containerup/login"
	"containerup/utils"
	"context"
	"github.com/containers/podman/v4/pkg/bindings/system"
	"github.com/containers/podman/v4/pkg/domain/entities"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"sync"
)

var (
	upgrader = websocket.Upgrader{}
)

func Events(w http.ResponseWriter, req *http.Request) {
	pmConn := conn.GetConn(req.Context())
	query := req.URL.Query()

	eventType := query.Get("type")
	switch eventType {
	case "container":
	case "image":
	default:
		http.Error(w, "Invalid event type", http.StatusBadRequest)
		return
	}
	id := query.Get("id")

	ws, err := upgrader.Upgrade(w, req, nil)
	if err != nil {
		// err replied in upgrader.Upgrade
		return
	}

	if !login.WebsocketAuth(ws) {
		return
	}

	if query.Get("needOkResp") == "1" {
		_ = ws.WriteMessage(websocket.TextMessage, []byte("true"))
	}

	pmConn, stopByServer, waitEnd, chEvent := eventsSender(pmConn, ws, id)

	err = system.Events(pmConn, chEvent, nil, &system.EventsOptions{
		Filters: map[string][]string{
			"type": {eventType},
		},
	})
	stopByServer(err)

	waitEnd()
}

type event struct {
	Type   string `json:"type"`
	Action string `json:"action"`
	Id     string `json:"id"`
	Name   string `json:"name"`
}

func eventsSender(pmConn context.Context, ws *websocket.Conn, id string) (context.Context, func(error), func(), chan entities.Event) {
	pmConn, cancel := context.WithCancel(pmConn)

	var wgWsReader, wgWsWriter, wgOutputReader sync.WaitGroup

	chWrite := make(chan *event)
	chEvent := make(chan entities.Event)

	waitEnd := func() {
		wgOutputReader.Wait() // redundant
		wgWsWriter.Wait()     // redundant
		wgWsReader.Wait()
		cancel() // redundant
	}

	stopByServer := func(err error) {
		// chEvent closed by system.Events
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
	go func() {
		wgWsReader.Add(1)
		defer wgWsReader.Done()

		var err error
		for err == nil {
			_, _, err = ws.ReadMessage()
		}
		//log.Printf("ws reader err: %v", err)
	}()

	go func() {
		wgWsWriter.Add(1)
		defer wgWsWriter.Done()

		var err error
		for msg := range chWrite {
			err = ws.WriteJSON(msg)
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

		for e := range chEvent {
			eId := e.Actor.ID
			if id != "" {
				if (len(id) == 12 && eId[0:12] != id) || eId != id {
					continue
				}
			}

			chWrite <- &event{
				Type:   e.Type,
				Action: e.Status,
				Id:     eId,                        // container, image
				Name:   e.Actor.Attributes["name"], // container, image
			}
		}
	}()

	return pmConn, stopByServer, waitEnd, chEvent
}
