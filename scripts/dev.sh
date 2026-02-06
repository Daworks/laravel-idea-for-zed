#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Laravel for Zed - Development Mode ==="

# Build and watch the LSP server
echo "[1/2] Starting LSP server in watch mode..."
cd "$ROOT_DIR/server"
npm install

# Start TypeScript watch in background
npm run watch &
TSC_PID=$!

echo "[2/2] LSP server watch mode started (PID: $TSC_PID)"
echo ""
echo "To test in Zed:"
echo "  1. Open Zed"
echo "  2. Run 'zed: install dev extension'"
echo "  3. Select the '$ROOT_DIR/extension' directory"
echo "  4. Open a Laravel project"
echo ""
echo "To stop: kill $TSC_PID or press Ctrl+C"

# Handle cleanup
trap "kill $TSC_PID 2>/dev/null; echo 'Stopped.'" EXIT

# Wait for the TypeScript compiler
wait $TSC_PID
