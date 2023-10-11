#!/bin/bash
if [[ -z "$PASSWORD" ]]; then
    echo "Environment variable PASSWORD is required."
    echo "Generate one by command 'echo <username>:<password> | sha256sum'."
    exit 1
fi

exec /usr/bin/containerup -listen 0.0.0.0:3876 -password "$PASSWORD"
