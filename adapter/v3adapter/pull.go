package v3adapter

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/containers/podman/v4/pkg/bindings/images"
	"github.com/containers/podman/v4/pkg/domain/entities"
	"github.com/hashicorp/go-multierror"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"strconv"
)

// ImagePull is the binding for libpod's v2 endpoints for pulling images.  Note that
// `rawImage` must be a reference to a registry (i.e., of docker transport or be
// normalized to one).  Other transports are rejected as they do not make sense
// in a remote context. Progress reported on stderr
// This method and related methods are heavily copied and modified from
// https://github.com/containers/podman/blob/v3.0.1/pkg/bindings/images/pull.go
func ImagePull(ctx context.Context, rawImage string, options *images.PullOptions) ([]string, error) {
	if options == nil {
		options = new(images.PullOptions)
	}
	conn, err := getClient(ctx)
	if err != nil {
		return nil, err
	}
	params, err := options.ToParams()
	if err != nil {
		return nil, err
	}
	params.Set("reference", rawImage)

	if options.SkipTLSVerify != nil {
		params.Del("SkipTLSVerify")
		// Note: we have to verify if skipped is false.
		params.Set("tlsVerify", strconv.FormatBool(!options.GetSkipTLSVerify()))
	}

	// TODO: authentication

	resp, err := conn.DoRequest(ctx, nil, http.MethodPost, "/images/pull", params)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return nil, err
	}

	// Historically pull writes status to stderr
	stderr := io.Writer(os.Stderr)
	if options.GetQuiet() {
		stderr = ioutil.Discard
	}

	dec := json.NewDecoder(resp.Body)
	var images []string
	var mErr error
	for {
		var report entities.ImagePullReport
		if err := dec.Decode(&report); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			report.Error = err.Error() + "\n"
		}

		select {
		case <-ctx.Done():
			return images, mErr
		default:
			// non-blocking select
		}

		switch {
		case report.Stream != "":
			fmt.Fprint(stderr, report.Stream)
		case report.Error != "":
			mErr = multierror.Append(mErr, errors.New(report.Error))
		case len(report.Images) > 0:
			images = report.Images
		case report.ID != "":
		default:
			return images, errors.New("failed to parse pull results stream, unexpected input")
		}
	}
	return images, mErr
}
