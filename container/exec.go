package container

import (
	"bufio"
	"containerup/conn"
	"containerup/login"
	"containerup/utils"
	"context"
	"errors"
	"fmt"
	"github.com/containers/podman/v4/pkg/api/handlers"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/docker/docker/api/types"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/mattn/go-shellwords"
	"io"
	"log"
	"net/http"
	"sync"
)

var (
	errMalformedData = errors.New("malformed data")
)

func Exec(w http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)
	nameOrId := vars["name"]
	pmConn := conn.GetConn(req.Context())
	query := req.URL.Query()

	execConfig := &handlers.ExecCreateConfig{
		ExecConfig: types.ExecConfig{
			AttachStdout: true,
			AttachStderr: true,
		},
	}

	envs, cmds, err := shellwords.ParseWithEnvs(query.Get("cmd"))
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid command: %v", err), http.StatusBadRequest)
		return
	}
	if len(cmds) == 0 || cmds[0] == "" {
		http.Error(w, "command is not specified", http.StatusBadRequest)
		return
	}

	execConfig.Cmd = cmds
	execConfig.Env = envs

	interactive := query.Get("interactive") == "1"
	if interactive {
		execConfig.AttachStdin = true
	}

	if t := query.Get("tty"); t == "1" {
		execConfig.Tty = true
	}

	if u := query.Get("user"); u != "" {
		execConfig.User = u
	}

	detach := query.Get("detach") == "1"
	if detach {
		execConfig.Detach = true
		if interactive {
			http.Error(w, "you cannot specify `interactive` and `detach` at the same time", http.StatusBadRequest)
		}
	}

	ws, err := upgrader.Upgrade(w, req, nil)
	if err != nil {
		// err replied in upgrader.Upgrade
		return
	}

	if !login.WebsocketAuth(ws) {
		return
	}

	//log.Printf("exec start...")
	//defer log.Printf("exec end")

	sessionId, err := containers.ExecCreate(pmConn, nameOrId, execConfig)
	if err != nil {
		ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(4002, err.Error()))
		return
	}

	stdOutReader, stdOutWriter := io.Pipe()
	stdErrReader, stdErrWriter := io.Pipe()
	var stdInWriter *io.PipeWriter

	yes := true
	startOpts := &containers.ExecStartAndAttachOptions{
		AttachOutput: &yes,
		AttachError:  &yes,
	}
	startOpts.WithOutputStream(stdOutWriter)
	startOpts.WithErrorStream(stdErrWriter)

	if interactive {
		var stdInReader *io.PipeReader
		stdInReader, stdInWriter = io.Pipe()

		startOpts.AttachInput = &yes
		startOpts.InputStream = bufio.NewReader(stdInReader)
	}

	if detach {
		err = containers.ExecStart(pmConn, sessionId, nil)
		if err != nil {
			ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(4002, err.Error()))
			return
		}
		ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		return
	}

	pmConn, stopByServer, waitEnd := execTransmitter(pmConn, ws, sessionId, stdOutReader, stdErrReader, stdInWriter)

	err = containers.ExecStartAndAttach(pmConn, sessionId, startOpts)

	exitCode := -1
	// websocket can be closed by user
	if pmConn.Err() == nil {
		inspectOut, err := containers.ExecInspect(pmConn, sessionId, nil)
		if err != nil {
			log.Printf("inspect err : %v", err)
		} else {
			exitCode = inspectOut.ExitCode
		}
	}

	stopByServer(err, exitCode)

	waitEnd()
}

func execTransmitter(pmConn context.Context, ws *websocket.Conn, sessionId string, stdOutReader, stdErrReader io.ReadCloser, stdInWriter io.WriteCloser) (context.Context, func(error, int), func()) {
	pmConn, cancel := context.WithCancel(pmConn)

	var wgWsReader, wgWsWriter, wgOutputReader sync.WaitGroup

	chWrite := make(chan []byte)

	waitEnd := func() {
		wgOutputReader.Wait() // redundant
		wgWsWriter.Wait()     // redundant
		wgWsReader.Wait()
		cancel() // redundant
	}

	stopByServer := func(err error, exitCode int) {
		// we have to close the pipes
		stdOutReader.Close()
		stdErrReader.Close()

		wgOutputReader.Wait()
		close(chWrite)
		wgWsWriter.Wait()

		wsCode := websocket.CloseNormalClosure
		text := fmt.Sprintf("ExitCode %d", exitCode)
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
		//log.Printf("exec ws client close: %d %s", code, text)
		_ = ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(code, ""))
		stopByClient(nil)
		return nil
	})

	if stdInWriter != nil {
		wgWsReader.Add(1)
		go func() {
			defer wgWsReader.Done()
			// defer stdInWriter.Close() // do not close it, as it closed in containers.ExecStartAndAttach

			var err1, err2 error
			var data []byte
			for err1 == nil && err2 == nil {
				_, data, err1 = ws.ReadMessage()
				if len(data) > 0 {
					switch data[0] {
					case '1':
						_, err2 = stdInWriter.Write(data[1:])
					case 'r':
						if len(data) != 5 {
							log.Printf("malformed data: %d", len(data))
							err2 = errMalformedData
							break
						}
						w := int(data[1])*256 + int(data[2])
						h := int(data[3])*256 + int(data[4])
						err2 = containers.ResizeExecTTY(pmConn, sessionId, &containers.ResizeExecTTYOptions{
							Height: &h,
							Width:  &w,
						})
					default:
						err2 = errMalformedData
					}
				}
			}
			// log.Printf("exec ws reader err: %v, err2: %v", err1, err2)
			if err2 != nil {
				log.Printf("exec err2: %v", err2)
				stopByClient(err2)
			}
		}()
	} else {
		// empty reader
		wgWsReader.Add(1)
		go func() {
			defer wgWsReader.Done()

			var err error
			for err == nil {
				_, _, err = ws.ReadMessage()
			}
		}()
	}

	wgWsWriter.Add(1)
	go func() {
		defer wgWsWriter.Done()

		var err error
		for msg := range chWrite {
			err = ws.WriteMessage(websocket.BinaryMessage, msg)
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

		var err error
		var n int
		for {
			buf := make([]byte, 1025)
			buf[0] = '1'
			n, err = stdOutReader.Read(buf[1:])
			if n > 0 {
				chWrite <- buf[:n+1]
			}
			if err != nil {
				break
			}
		}
		//log.Printf("stdOutReader err: %v", err)
	}()

	wgOutputReader.Add(1)
	go func() {
		defer wgOutputReader.Done()

		var err error
		var n int
		for {
			buf := make([]byte, 1025)
			buf[0] = '2'
			n, err = stdErrReader.Read(buf[1:])
			if n > 0 {
				chWrite <- buf[:n+1]
			}
			if err != nil {
				break
			}
		}
		//log.Printf("stdErrReader err: %v", err)
	}()

	return pmConn, stopByServer, waitEnd
}
