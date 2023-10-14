FROM docker.io/library/alpine:3.18
ARG TARGETARCH
COPY mime.types /etc
COPY containerup_linux_$TARGETARCH /usr/bin/containerup
COPY entrypoint.sh /
EXPOSE 3876
VOLUME /run/podman/podman.sock
ENTRYPOINT ["/entrypoint.sh"]
