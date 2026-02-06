#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VERSION="1.0.0"

echo "=== Packaging Laravel for Zed v${VERSION} ==="

# Build first
"$SCRIPT_DIR/build.sh"

# Create package directory
PACKAGE_DIR="$ROOT_DIR/package/laravel-for-zed"
rm -rf "$ROOT_DIR/package"
mkdir -p "$PACKAGE_DIR/server/dist"

# Copy extension files
cp "$ROOT_DIR/extension/extension.toml" "$PACKAGE_DIR/"
cp "$ROOT_DIR/extension/target/wasm32-wasip1/release/zed_laravel.wasm" "$PACKAGE_DIR/"

# Copy language definitions if they exist
if [ -d "$ROOT_DIR/extension/languages" ]; then
    cp -r "$ROOT_DIR/extension/languages" "$PACKAGE_DIR/"
fi
if [ -d "$ROOT_DIR/extension/grammars" ]; then
    cp -r "$ROOT_DIR/extension/grammars" "$PACKAGE_DIR/"
fi

# Copy built LSP server and its dependencies
cp "$ROOT_DIR/server/dist/server.js" "$PACKAGE_DIR/server/dist/"
cp "$ROOT_DIR/server/package.json" "$PACKAGE_DIR/server/"

# Install production dependencies for the server
cd "$PACKAGE_DIR/server"
npm install --omit=dev --ignore-scripts 2>/dev/null
cd "$ROOT_DIR"

# Create tar.gz
cd "$ROOT_DIR/package"
tar -czf "laravel-for-zed-v${VERSION}.tar.gz" laravel-for-zed/

echo ""
echo "=== Package ready ==="
echo "Archive: $ROOT_DIR/package/laravel-for-zed-v${VERSION}.tar.gz"
echo ""
echo "Contents:"
tar -tzf "laravel-for-zed-v${VERSION}.tar.gz" | head -20
echo "..."
du -sh "laravel-for-zed-v${VERSION}.tar.gz"
