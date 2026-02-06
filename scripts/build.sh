#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Building Laravel Language Server ==="

# Build TypeScript server
echo "[1/3] Building LSP server..."
cd "$ROOT_DIR/server"
npm install
npm run build

echo "[2/3] Verifying server build..."
if [ ! -f "$ROOT_DIR/server/dist/server.js" ]; then
    echo "ERROR: server.js not found in dist/"
    exit 1
fi

# Build Zed extension (Rust → WASM)
echo "[3/3] Building Zed extension..."
cd "$ROOT_DIR/extension"

# Check if wasm target is installed
if ! rustup target list --installed | grep -q wasm32-wasip1; then
    echo "Installing wasm32-wasip1 target..."
    rustup target add wasm32-wasip1
fi

cargo build --release --target wasm32-wasip1

echo ""
echo "=== Build complete ==="
echo "Server: $ROOT_DIR/server/dist/server.js"
echo "Extension: $ROOT_DIR/extension/target/wasm32-wasip1/release/zed_laravel.wasm"
