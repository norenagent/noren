FROM alpine:3.20
COPY web-starter /usr/local/bin/web-starter
RUN chmod 0755 /usr/local/bin/web-starter && adduser -D -u 10001 runner
USER 10001
WORKDIR /workspace
