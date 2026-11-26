#!/bin/bash
# Keycloak 26 exposes health endpoints on the management port (9000), and the
# container image has no curl, so the probe uses bash's /dev/tcp pseudo-device.
exec 3<>/dev/tcp/localhost/9000 || exit 1
printf 'GET /health/ready HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3
read -t 10 status <&3
[ "$status" = "HTTP/1.1 200 OK" ]
