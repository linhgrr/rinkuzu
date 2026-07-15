#!/usr/bin/env bash

set -euo pipefail

readonly container_name='rinkuzu-ci-mongo'
readonly image='mongo@sha256:93a90c2ee50cc151797f668908835896bd2fa0703a69a4716f90453ea0fd355c'
readonly max_attempts=30

case "${1:-}" in
  start)
    docker run --detach --name "$container_name" \
      --publish 27017:27017 \
      "$image" \
      --replSet rs0 --bind_ip_all --port 27017

    ping_ready='false'
    for attempt in $(seq 1 "$max_attempts"); do
      if [[ "$(docker inspect --format '{{.State.Running}}' "$container_name")" != 'true' ]]; then
        echo 'MongoDB container stopped during startup' >&2
        docker logs "$container_name" >&2 || true
        docker rm --force --volumes "$container_name" >/dev/null 2>&1 || true
        exit 1
      fi
      if docker exec "$container_name" mongosh --quiet \
        --eval 'db.adminCommand({ ping: 1 })' >/dev/null 2>&1; then
        ping_ready='true'
        break
      fi
      sleep 2
    done
    if [[ "$ping_ready" != 'true' ]]; then
      echo "MongoDB did not accept connections after ${max_attempts} attempts" >&2
      docker logs "$container_name" >&2 || true
      docker rm --force --volumes "$container_name" >/dev/null 2>&1 || true
      exit 1
    fi

    docker exec "$container_name" mongosh --quiet --eval \
      'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})' >/dev/null

    primary_ready='false'
    for attempt in $(seq 1 "$max_attempts"); do
      if docker exec "$container_name" mongosh --quiet \
        --eval 'if (!db.hello().isWritablePrimary) { quit(1) }' >/dev/null; then
        primary_ready='true'
        break
      fi
      sleep 2
    done
    if [[ "$primary_ready" != 'true' ]]; then
      echo "MongoDB replica set did not elect a primary after ${max_attempts} attempts" >&2
      docker logs "$container_name" >&2 || true
      docker rm --force --volumes "$container_name" >/dev/null 2>&1 || true
      exit 1
    fi
    ;;
  stop)
    if docker inspect "$container_name" >/dev/null 2>&1; then
      docker rm --force --volumes "$container_name" >/dev/null
    fi
    ;;
  *)
    echo 'Usage: bash scripts/ci-mongodb.sh <start|stop>' >&2
    exit 64
    ;;
esac
