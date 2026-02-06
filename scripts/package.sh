#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Packaging Laravel for Zed ==="

# Build first
"$SCRIPT_DIR/build.sh"

# Create package directory
PACKAGE_DIR="$ROOT_DIR/package"
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

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

echo ""
echo "=== Package ready at: $PACKAGE_DIR ==="
ls -la "$PACKAGE_DIR/"
