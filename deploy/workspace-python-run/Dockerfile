FROM python:3.12-alpine
RUN adduser -D -u 10001 runner \
 && rm -f /usr/local/bin/pip* /usr/local/bin/easy_install* \
 && rm -rf /usr/local/lib/python3.12/site-packages/pip* /usr/local/lib/python3.12/ensurepip
# The official image strips every .pyc and the runtime root is read-only, so each
# import would recompile from source (unittest alone took ~8 s under gVisor).
# Precompile the stdlib at build time, while the filesystem is still writable.
RUN python3 -m compileall -q -j0 /usr/local/lib/python3.12 \
 && find /usr/local/lib/python3.12 -name __pycache__ | head -1 | grep -q .
COPY python-run /usr/local/bin/python-run
RUN chmod 0755 /usr/local/bin/python-run
USER 10001
WORKDIR /workspace
