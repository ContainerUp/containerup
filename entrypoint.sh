#!/bin/sh

if [[ "$#" -gt 0 ]]; then
    exec $@
fi

ARG_V3=""
if [[ -n "$CONTAINERUP_PODMAN_V3" ]]; then
    ARG_V3="-v3"
fi

if [[ -n "$CONTAINERUP_UPDATE_RUN" ]]; then
    exec /usr/bin/containerup $ARG_V3
fi

ARG_USERNAME=""
if [[ -n "$CONTAINERUP_USERNAME" ]]; then
    ARG_USERNAME="-username $CONTAINERUP_USERNAME"
fi

ARG_TLS=""
if [[ -n "$CONTAINERUP_TLS_CERT" ]]; then
    if [[ -z "$CONTAINERUP_TLS_KEY" ]]; then
        echo "Environment variable CONTAINERUP_TLS_KEY is required when CONTAINERUP_TLS_CERT is specified."
        exit 1
    fi
    ARG_TLS="-tls-cert $CONTAINERUP_TLS_CERT -tls-key $CONTAINERUP_TLS_KEY"
fi

if [[ -z "$CONTAINERUP_PASSWORD_HASH" ]]; then
    echo "Environment variable CONTAINERUP_PASSWORD_HASH is required."
    echo "Generate a password hash by command 'podman run --rm -it quay.io/containerup/containerup:latest containerup -generate-hash'"
    exit 1
fi
ARG_PASSWORD="-password-hash $CONTAINERUP_PASSWORD_HASH"

exec /usr/bin/containerup -listen 0.0.0.0:3876 $ARG_USERNAME $ARG_PASSWORD $ARG_V3 $ARG_TLS
