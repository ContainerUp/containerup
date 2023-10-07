package v3adapter

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/containers/podman/v4/pkg/api/handlers/types"
	"github.com/containers/podman/v4/pkg/bindings/images"
	"github.com/containers/podman/v4/pkg/domain/entities"
	"github.com/containers/podman/v4/pkg/errorhandling"
	"net/http"
	"net/url"
)

func ImageList(ctx context.Context, options *images.ListOptions) ([]*entities.ImageSummary, error) {
	conn, err := getClient(ctx)
	if err != nil {
		return nil, err
	}

	params, err := options.ToParams()
	if err != nil {
		return nil, err
	}
	resp, err := conn.DoRequest(ctx, nil, http.MethodGet, "/images/json", params)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return nil, err
	}

	var result []*entities.ImageSummary
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func ImageRemove(ctx context.Context, images []string, options *images.RemoveOptions) (*entities.ImageRemoveReport, []error) {
	conn, err := getClient(ctx)
	if err != nil {
		return nil, []error{err}
	}

	params, err := options.ToParams()
	if err != nil {
		return nil, []error{err}
	}
	for _, image := range images {
		params.Add("images", image)
	}
	resp, err := conn.DoRequest(ctx, nil, http.MethodDelete, "/images/remove", params)
	if err != nil {
		return nil, []error{err}
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return nil, []error{err}
	}

	var report types.LibpodImagesRemoveReport
	err = json.NewDecoder(resp.Body).Decode(&report)
	if err != nil {
		return nil, []error{err}
	}

	return &report.ImageRemoveReport, errorhandling.StringsToErrors(report.Errors)
}

func ImageTag(ctx context.Context, nameOrID, tag, repo string, _ *images.TagOptions) error {
	conn, err := getClient(ctx)
	if err != nil {
		return err
	}

	params := url.Values{}
	params.Set("tag", tag)
	params.Set("repo", repo)
	ep := fmt.Sprintf("/images/%s/tag", nameOrID)
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

func ImageGet(ctx context.Context, nameOrID string, options *images.GetOptions) (*entities.ImageInspectReport, error) {
	if options == nil {
		options = new(images.GetOptions)
	}
	conn, err := getClient(ctx)
	if err != nil {
		return nil, err
	}
	params, err := options.ToParams()
	if err != nil {
		return nil, err
	}
	ep := fmt.Sprintf("/images/%s/json", nameOrID)
	resp, err := conn.DoRequest(ctx, nil, http.MethodGet, ep, params)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return nil, err
	}

	var result entities.ImageInspectReport
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}
