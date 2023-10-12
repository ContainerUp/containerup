FROM alpine:3.18
COPY mime.types /etc
COPY containerup /usr/bin
COPY entrypoint.sh /
EXPOSE 3876
VOLUME /run/podman/podman.sock
ENTRYPOINT ["/entrypoint.sh"]
