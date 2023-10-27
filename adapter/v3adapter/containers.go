package v3adapter

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/containers/podman/v4/libpod/define"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/containers/podman/v4/pkg/domain/entities"
	"github.com/containers/podman/v4/pkg/domain/entities/reports"
	"github.com/containers/podman/v4/pkg/specgen"
	"io"
	"net/http"
)

func ContainerCreateWithSpec(ctx context.Context, s *specgen.SpecGenerator, options *containers.CreateOptions) (entities.ContainerCreateResponse, error) {
	var ccr entities.ContainerCreateResponse
	if options == nil {
		options = new(containers.CreateOptions)
	}
	_ = options
	conn, err := getClient(ctx)
	if err != nil {
		return ccr, err
	}
	specBytes, err := json.Marshal(s)
	if err != nil {
		return ccr, err
	}
	specReader := bytes.NewReader(specBytes)
	resp, err := conn.DoRequest(ctx, specReader, http.MethodPost, "/containers/create", nil)
	if err != nil {
		return ccr, err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return ccr, err
	}

	err = json.NewDecoder(resp.Body).Decode(&ccr)
	if err != nil {
		return ccr, err
	}

	return ccr, nil
}

func ContainerList(ctx context.Context, options *containers.ListOptions) ([]entities.ListContainer, error) {
	conn, err := getClient(ctx)
	if err != nil {
		return nil, err
	}

	params, err := options.ToParams()
	if err != nil {
		return nil, err
	}
	resp, err := conn.DoRequest(ctx, nil, http.MethodGet, "/containers/json", params)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return nil, err
	}

	var result []entities.ListContainer
	var tmpMap []map[string]any

	d, err := io.ReadAll(resp.Body)
	if err != nil {
		return result, nil
	}

	err = json.Unmarshal(d, &tmpMap)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(d, &result)
	if err != nil {
		return nil, err
	}

	for i, ctn := range tmpMap {
		if ports, ok := ctn["Ports"].([]any); ok {
			for j, portAny := range ports {
				if port, ok := portAny.(map[string]any); ok {
					resCtn := result[i]
					p := resCtn.Ports[j]
					p.HostIP = port["hostIP"].(string)
					p.HostPort = uint16(port["hostPort"].(float64))
					p.ContainerPort = uint16(port["containerPort"].(float64))
					resCtn.Ports[j] = p
					result[i] = resCtn
				}
			}
		}
	}

	return result, nil
}

func ContainerStop(ctx context.Context, nameOrID string, options *containers.StopOptions) error {
	conn, err := getClient(ctx)
	if err != nil {
		return err
	}

	params, err := options.ToParams()
	if err != nil {
		return err
	}
	ep := fmt.Sprintf("/containers/%s/stop", nameOrID)
	resp, err := conn.DoRequest(ctx, nil, http.MethodPost, ep, params)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return err
	}
	return nil
}

func ContainerStart(ctx context.Context, nameOrID string, options *containers.StartOptions) error {
	conn, err := getClient(ctx)
	if err != nil {
		return err
	}

	params, err := options.ToParams()
	if err != nil {
		return err
	}
	ep := fmt.Sprintf("/containers/%s/start", nameOrID)
	resp, err := conn.DoRequest(ctx, nil, http.MethodPost, ep, params)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return err
	}
	return nil
}

func ContainerRemove(ctx context.Context, nameOrID string, options *containers.RemoveOptions) ([]*reports.RmReport, error) {
	conn, err := getClient(ctx)
	if err != nil {
		return nil, err
	}

	params, err := options.ToParams()
	if err != nil {
		return nil, err
	}
	ep := fmt.Sprintf("/containers/%s", nameOrID)
	resp, err := conn.DoRequest(ctx, nil, http.MethodDelete, ep, params)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return nil, err
	}

	// fake report
	return []*reports.RmReport{{Id: nameOrID}}, nil
}

func ContainerRename(ctx context.Context, nameOrID string, options *containers.RenameOptions) error {
	conn, err := getClient(ctx)
	if err != nil {
		return err
	}

	params, err := options.ToParams()
	if err != nil {
		return err
	}
	ep := fmt.Sprintf("/containers/%s/rename", nameOrID)
	resp, err := conn.DoRequest(ctx, nil, http.MethodPost, ep, params)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return err
	}
	return nil
}

func ContainerRunHealthCheck(ctx context.Context, nameOrID string, options *containers.HealthCheckOptions) (*define.HealthCheckResults, error) {
	conn, err := getClient(ctx)
	if err != nil {
		return nil, err
	}

	params, err := options.ToParams()
	if err != nil {
		return nil, err
	}
	ep := fmt.Sprintf("/containers/%s/healthcheck", nameOrID)
	resp, err := conn.DoRequest(ctx, nil, http.MethodGet, ep, params)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return nil, err
	}

	var result define.HealthCheckResults
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

func ContainerCommit(ctx context.Context, nameOrID string, options *containers.CommitOptions) (entities.IDResponse, error) {
	var result entities.IDResponse

	conn, err := getClient(ctx)
	if err != nil {
		return result, err
	}

	params, err := options.ToParams()
	if err != nil {
		return result, err
	}
	params.Set("container", nameOrID)
	resp, err := conn.DoRequest(ctx, nil, http.MethodPost, "/commit", params)
	if err != nil {
		return result, err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return result, err
	}

	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return entities.IDResponse{}, err
	}

	return result, nil
}

func ContainerInspect(ctx context.Context, nameOrID string, options *containers.InspectOptions) (*define.InspectContainerData, error) {
	conn, err := getClient(ctx)
	if err != nil {
		return nil, err
	}

	params, err := options.ToParams()
	if err != nil {
		return nil, err
	}
	ep := fmt.Sprintf("/containers/%s/json", nameOrID)
	resp, err := conn.DoRequest(ctx, nil, http.MethodGet, ep, params)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return nil, err
	}

	var result define.InspectContainerData
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

// ContainerLogs obtains a container's logs given the options provided.
// The logs are then sent to the stdout|stderr channels as strings.
// This method and related methods are heavily copied and modified from
// https://github.com/containers/podman/blob/v3.0.1/pkg/bindings/containers/logs.go
func ContainerLogs(ctx context.Context, nameOrID string, options *containers.LogOptions, stdoutChan, stderrChan chan string) error {
	conn, err := getClient(ctx)
	if err != nil {
		return err
	}

	params, err := options.ToParams()
	if err != nil {
		return err
	}
	if options.Stdout == nil && options.Stderr == nil {
		params.Set("stdout", "true")
	}
	ep := fmt.Sprintf("/containers/%s/logs", nameOrID)
	resp, err := conn.DoRequest(ctx, nil, http.MethodGet, ep, params)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return err
	}

	buffer := make([]byte, 1024)
	for {
		fd, l, err := containers.DemuxHeader(resp.Body, buffer)
		if err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}
		frame, err := containers.DemuxFrame(resp.Body, buffer, l)
		if err != nil {
			return err
		}

		switch fd {
		case 0:
			stdoutChan <- string(frame) + "\n"
		case 1:
			stdoutChan <- string(frame) + "\n"
		case 2:
			stderrChan <- string(frame) + "\n"
		case 3:
			return errors.New("error from service in stream: " + string(frame))
		default:
			return fmt.Errorf("unrecognized input header: %d", fd)
		}
	}
}

// ContainerStats This method and related methods are heavily copied and modified from
// https://github.com/containers/podman/blob/v3.0.1/pkg/bindings/containers/containers.go
func ContainerStats(ctx context.Context, ctns []string, options *containers.StatsOptions) (chan entities.ContainerStatsReport, error) {
	if options == nil {
		options = new(containers.StatsOptions)
	}
	_ = options
	conn, err := getClient(ctx)
	if err != nil {
		return nil, err
	}
	params, err := options.ToParams()
	if err != nil {
		return nil, err
	}
	for _, c := range ctns {
		params.Add("containers", c)
	}

	resp, err := conn.DoRequest(ctx, nil, http.MethodGet, "/containers/stats", params)
	if err != nil {
		return nil, err
	}

	if err := checkResp(resp); err != nil {
		return nil, err
	}

	statsChan := make(chan entities.ContainerStatsReport)

	go func() {
		defer close(statsChan)

		dec := json.NewDecoder(resp.Body)
		doStream := true
		if options.Changed("Stream") {
			doStream = options.GetStream()
		}

	streamLabel: // label to flatten the scope
		select {
		case <-ctx.Done():
			return // lost connection - maybe the server quit
		default:
			// fall through and do some work
		}
		var report entities.ContainerStatsReport
		if err := dec.Decode(&report); err != nil {
			report = entities.ContainerStatsReport{Error: err}
		}
		statsChan <- report

		if report.Error != nil || !doStream {
			return
		}
		goto streamLabel
	}()

	return statsChan, nil
}
