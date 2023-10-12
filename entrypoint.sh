#!/bin/sh
if [[ -z "$CONTAINERUP_PASSWORD" ]]; then
    echo "Environment variable CONTAINERUP_PASSWORD is required."
    echo "Generate one by command 'echo <username>:<password> | sha256sum'."
    exit 1
fi

V3=""
if [[ -n "$CONTAINERUP_PODMAN_V3" ]]; then
    V3="-v3"
fi

exec /usr/bin/containerup -listen 0.0.0.0:3876 -password "$CONTAINERUP_PASSWORD" $V3
