#!/bin/bash
#
# GitHub Issue Manager — Service Management Script
# Usage: ./server.sh {start|stop|restart|status|log}
#

export PATH=/mnt/disk1/yy/tools/python/bin:$PATH
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/server.pid"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/server.log"
PORT=8081
PYTHON="${PYTHON:-python3}"

mkdir -p "$LOG_DIR"

case "$1" in
    start)
        if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
            echo "Server is already running (PID: $(cat "$PID_FILE"))"
            exit 1
        fi
        echo "Starting GitHub Issue Manager on port $PORT..."
        cd "$SCRIPT_DIR"
        PORT=$PORT nohup $PYTHON server.py >> "$LOG_FILE" 2>&1 &
        echo $! > "$PID_FILE"
        sleep 1
        if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
            echo "✓ Server started (PID: $(cat "$PID_FILE"))"
            echo "  → http://localhost:$PORT"
        else
            echo "✗ Failed to start server. Check logs: $LOG_FILE"
            rm -f "$PID_FILE"
            exit 1
        fi
        ;;
    stop)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if kill -0 "$PID" 2>/dev/null; then
                echo "Stopping server (PID: $PID)..."
                kill "$PID"
                sleep 1
                if kill -0 "$PID" 2>/dev/null; then
                    kill -9 "$PID"
                fi
                echo "✓ Server stopped"
            else
                echo "Server is not running (stale PID file)"
            fi
            rm -f "$PID_FILE"
        else
            echo "Server is not running (no PID file)"
        fi
        ;;
    restart)
        "$0" stop
        sleep 1
        "$0" start
        ;;
    status)
        if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
            echo "✓ Server is running (PID: $(cat "$PID_FILE"))"
            echo "  → http://localhost:$PORT"
        else
            echo "✗ Server is not running"
        fi
        ;;
    log)
        if [ -f "$LOG_FILE" ]; then
            tail -f "$LOG_FILE"
        else
            echo "No log file found"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|log}"
        exit 1
        ;;
esac
