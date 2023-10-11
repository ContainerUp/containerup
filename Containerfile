FROM docker.io/library/debian:12
RUN apt-get update && apt-get install -y media-types && apt-get clean
COPY containerup /usr/bin
COPY entrypoint.sh /
EXPOSE 3876
VOLUME /run/podman/podman.sock
ENTRYPOINT ["/entrypoint.sh"]
