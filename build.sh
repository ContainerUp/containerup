#!/bin/bash
set -e

PACKAGE="containerup"
VERSION=$(cat VERSION)

if [[ -z "$COMMIT_HASH" ]]; then
  echo "Missing env COMMIT_HASH"
  exit 1
fi

if [[ -z "$FE_COMMIT_HASH" ]]; then
  echo "Missing env FE_COMMIT_HASH"
  exit 1
fi

if [[ -z "$BUILD_NUM" ]]; then
  echo "Missing env BUILD_NUM"
  exit 1
fi

if [[ -z "$GOOS" ]]; then
  echo "Missing env GOOS"
  exit 1
fi

if [[ -z "$GOARCH" ]]; then
  echo "Missing env GOARCH"
  exit 1
fi

LDFLAGS=(
  "-X '${PACKAGE}/system.Version=${VERSION}'"
  "-X '${PACKAGE}/system.CommitHash=${COMMIT_HASH}'"
  "-X '${PACKAGE}/system.FrontendCommitHash=${FE_COMMIT_HASH}'"
  "-X '${PACKAGE}/system.BuildNum=${BUILD_NUM}'"
)

# Podman tags
TAGS="remote exclude_graphdriver_btrfs btrfs_noversion exclude_graphdriver_devicemapper containers_image_openpgp"

go build -ldflags "${LDFLAGS[*]}" -tags "$TAGS" -trimpath -o "${PACKAGE}_${GOOS}_${GOARCH}"
