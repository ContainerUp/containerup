package v3adapter

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/containers/podman/v4/libpod/define"
	"github.com/containers/podman/v4/pkg/api/handlers"
	"github.com/containers/podman/v4/pkg/bindings"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/containers/podman/v4/pkg/domain/entities"
	sig "github.com/containers/podman/v4/pkg/signal"
	"golang.org/x/crypto/ssh/terminal"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"time"
)

func ContainerExecCreate(ctx context.Context, nameOrID string, options *handlers.ExecCreateConfig) (string, error) {
	conn, err := getClient(ctx)
	if err != nil {
		return "", err
	}

	if options == nil {
		return "", errors.New("options required")
	}

	reqBytes, err := json.Marshal(options)
	if err != nil {
		return "", err
	}
	reqBody := bytes.NewReader(reqBytes)

	ep := fmt.Sprintf("/containers/%s/exec", nameOrID)
	resp, err := conn.DoRequest(ctx, reqBody, http.MethodPost, ep, nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return "", err
	}

	var result entities.IDResponse
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return "", err
	}

	return result.ID, nil
}

func ContainerExecStart(ctx context.Context, sessionID string, _ *containers.ExecStartOptions) error {
	conn, err := getClient(ctx)
	if err != nil {
		return err
	}

	options := map[string]any{
		"Detach": true,
	}
	reqBytes, err := json.Marshal(options)
	if err != nil {
		return err
	}
	reqBody := bytes.NewReader(reqBytes)

	ep := fmt.Sprintf("/containers/%s/start", sessionID)
	resp, err := conn.DoRequest(ctx, reqBody, http.MethodPost, ep, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return err
	}

	var result entities.IDResponse
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return err
	}

	return nil
}

// ContainerExecStartAndAttach starts and attaches to a given exec session.
// This method and related methods are heavily copied and modified from
// https://github.com/containers/podman/blob/v3.0.1/pkg/bindings/containers/attach.go
func ContainerExecStartAndAttach(ctx context.Context, sessionID string, options *containers.ExecStartAndAttachOptions) error {
	if options == nil {
		options = new(containers.ExecStartAndAttachOptions)
	}
	conn, err := getClient(ctx)
	if err != nil {
		return err
	}

	// TODO: Make this configurable (can't use streams' InputStream as it's
	// buffered)
	terminalFile := os.Stdin

	// We need to inspect the exec session first to determine whether to use
	// -t.
	ep := fmt.Sprintf("/exec/%s/json", sessionID)
	resp, err := conn.DoRequest(ctx, nil, http.MethodGet, ep, nil)
	if err != nil {
		return err
	}

	if err := checkResp(resp); err != nil {
		return err
	}

	var result define.InspectExecSession
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return err
	}

	isTerm := true
	if result.ProcessConfig != nil {
		isTerm = result.ProcessConfig.Tty
	}

	// If we are in TTY mode, we need to set raw mode for the terminal.
	// TODO: Share all of this with Attach() for containers.
	needTTY := terminalFile != nil && terminal.IsTerminal(int(terminalFile.Fd())) && isTerm
	if needTTY {
		state, err := setRawTerminal(terminalFile)
		if err != nil {
			return err
		}
		defer func() {
			if err := terminal.Restore(int(terminalFile.Fd()), state); err != nil {
				log.Printf("Exec, unable to restore terminal: %q", err)
			}
		}()
	}

	body := map[string]any{
		"Detach": false,
	}
	reqBytes, err := json.Marshal(body)
	if err != nil {
		return err
	}
	reqBody := bytes.NewReader(reqBytes)

	var socket net.Conn
	socketSet := false
	dialContext := conn.Client.Transport.(*http.Transport).DialContext
	t := &http.Transport{
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			c, err := dialContext(ctx, network, address)
			if err != nil {
				return nil, err
			}
			if !socketSet {
				socket = c
				socketSet = true
			}
			return c, err
		},
		IdleConnTimeout: time.Duration(0),
	}
	conn.Client.Transport = t

	ep = fmt.Sprintf("/exec/%s/start", sessionID)
	resp, err = conn.DoRequest(ctx, reqBody, http.MethodPost, ep, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode > 299 {
		d, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("%s", d)
	}

	if needTTY {
		winChange := make(chan os.Signal, 1)
		signal.Notify(winChange, sig.SIGWINCH)
		winCtx, winCancel := context.WithCancel(ctx)
		defer winCancel()

		go attachHandleResize(ctx, winCtx, winChange, sessionID, terminalFile)
	}

	if options.GetAttachInput() {
		go func() {
			_, err := CopyDetachable(socket, options.InputStream, []byte{})
			if err != nil {
				log.Printf("failed to write input to service: " + err.Error())
			}
		}()
	}

	buffer := make([]byte, 1024)
	if isTerm {
		if !options.GetAttachOutput() {
			return fmt.Errorf("exec session %s has a terminal and must have STDOUT enabled", sessionID)
		}
		// If not multiplex'ed, read from server and write to stdout
		_, err := CopyDetachable(options.GetOutputStream(), socket, []byte{})
		if err != nil {
			return err
		}
	} else {
		for {
			// Read multiplexed channels and write to appropriate stream
			fd, l, err := containers.DemuxHeader(socket, buffer)
			if err != nil {
				if errors.Is(err, io.EOF) {
					return nil
				}
				return err
			}
			frame, err := containers.DemuxFrame(socket, buffer, l)
			if err != nil {
				return err
			}

			switch {
			case fd == 0:
				if options.GetAttachInput() {
					// Write STDIN to STDOUT (echoing characters
					// typed by another attach session)
					if _, err := options.GetOutputStream().Write(frame[0:l]); err != nil {
						return err
					}
				}
			case fd == 1:
				if options.GetAttachOutput() {
					if _, err := options.GetOutputStream().Write(frame[0:l]); err != nil {
						return err
					}
				}
			case fd == 2:
				if options.GetAttachError() {
					if _, err := options.GetErrorStream().Write(frame[0:l]); err != nil {
						return err
					}
				}
			case fd == 3:
				return fmt.Errorf("error from service from stream: %s", frame)
			default:
				return fmt.Errorf("unrecognized channel '%d' in header, 0-3 supported", fd)
			}
		}
	}
	return nil
}

// Configure the given terminal for raw mode
func setRawTerminal(file *os.File) (*terminal.State, error) {
	state, err := terminal.MakeRaw(int(file.Fd()))
	if err != nil {
		return nil, err
	}

	return state, err
}

// This is intended to be run as a goroutine, handling resizing for a container
// or exec session.
func attachHandleResize(ctx, winCtx context.Context, winChange chan os.Signal, id string, file *os.File) {
	// Prime the pump, we need one reset to ensure everything is ready
	winChange <- sig.SIGWINCH
	for {
		select {
		case <-winCtx.Done():
			return
		case <-winChange:
			w, h, err := terminal.GetSize(int(file.Fd()))
			if err != nil {
				log.Printf("Exec, failed to obtain TTY size: %v", err)
			}

			resizeErr := resizeTTY(ctx, id, &h, &w)
			if resizeErr != nil {
				log.Printf("Exec, failed to resize TTY: %v", resizeErr)
			}
		}
	}
}

// resizeTTY set size of TTY of container
func resizeTTY(ctx context.Context, id string, height *int, width *int) error {
	conn, err := getClient(ctx)
	if err != nil {
		return err
	}

	params := url.Values{}
	if height != nil {
		params.Set("h", strconv.Itoa(*height))
	}
	if width != nil {
		params.Set("w", strconv.Itoa(*width))
	}
	params.Set("running", "true")

	ep := fmt.Sprintf("/exec/%s/resize", id)
	resp, err := conn.DoRequest(ctx, nil, http.MethodPost, ep, params)
	if err != nil {
		return err
	}
	if resp.StatusCode > 299 {
		d, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("%s", d)
	}
	return nil
}

var ErrDetach = define.ErrDetach

// CopyDetachable is similar to io.Copy but support a detach key sequence to break out.
func CopyDetachable(dst io.Writer, src io.Reader, keys []byte) (written int64, err error) {
	buf := make([]byte, 32*1024)
	for {
		nr, er := src.Read(buf)
		if nr > 0 {
			preservBuf := []byte{}
			for i, key := range keys {
				preservBuf = append(preservBuf, buf[0:nr]...)
				if nr != 1 || buf[0] != key {
					break
				}
				if i == len(keys)-1 {
					return 0, ErrDetach
				}
				nr, er = src.Read(buf)
			}
			var nw int
			var ew error
			if len(preservBuf) > 0 {
				nw, ew = dst.Write(preservBuf)
				nr = len(preservBuf)
			} else {
				nw, ew = dst.Write(buf[0:nr])
			}
			if nw > 0 {
				written += int64(nw)
			}
			if ew != nil {
				err = ew
				break
			}
			if nr != nw {
				err = io.ErrShortWrite
				break
			}
		}
		if er != nil {
			if er != io.EOF {
				err = er
			}
			break
		}
	}
	return written, err
}

func ContainerExecInspect(ctx context.Context, sessionID string, options *containers.ExecInspectOptions) (*define.InspectExecSession, error) {
	if options == nil {
		options = new(containers.ExecInspectOptions)
	}
	_ = options
	conn, err := getClient(ctx)
	if err != nil {
		return nil, err
	}

	ep := fmt.Sprintf("/exec/%s/json", sessionID)
	resp, err := conn.DoRequest(ctx, nil, http.MethodGet, ep, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return nil, err
	}

	var result define.InspectExecSession
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

func ContainerResizeExecTTY(ctx context.Context, nameOrID string, options *containers.ResizeExecTTYOptions) error {
	if options == nil {
		options = new(containers.ResizeExecTTYOptions)
	}
	return resizeTTY(ctx, bindings.JoinURL("exec", nameOrID, "resize"), options.Height, options.Width)
}
