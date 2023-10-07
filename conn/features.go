package conn

import (
	"containerup/adapter"
	"context"
	"github.com/blang/semver/v4"
)

// BugReversedContainerStatsNetwork checks if the server version is below 4.4.0 https://github.com/containers/podman/pull/16628
func BugReversedContainerStatsNetwork(ctx context.Context) bool {
	v := adapter.ServiceVersion(ctx)
	if v.Major == 0 {
		// empty
		return false
	}
	if v.LT(semver.Version{Major: 4, Minor: 4}) {
		return true
	}
	return false
}

// FeatureContainerStatsInterval checks if the server version is above 3.4.0
func FeatureContainerStatsInterval(ctx context.Context) bool {
	v := adapter.ServiceVersion(ctx)
	if v.GE(semver.Version{Major: 3, Minor: 4}) {
		return true
	}
	return false
}
