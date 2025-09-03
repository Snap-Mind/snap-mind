#!/usr/bin/env bash
set -euo pipefail

# build-macos-helper.sh
# Simple script to compile helper/SelectedText.swift for the current or specified macOS arch.
# Usage:
#   ./build-macos-helper.sh --arm64
#   ./build-macos-helper.sh --x64
#   ./build-macos-helper.sh        # auto detect

if [ "${1:-}" = "--arm64" ]; then
  PLATFORM="arm64"
elif [ "${1:-}" = "--x64" ] || [ "${1:-}" = "--x86_64" ]; then
  PLATFORM="x64"
else
  ARCH=$(uname -m)
  if [ "$ARCH" = "arm64" ]; then
    PLATFORM="arm64"
  else
    PLATFORM="x64"
  fi
fi

echo "Build helper for platform: $PLATFORM"

# Clean previous outputs
rm -f helper/selectedtext helper/selectedtext.* || true

if [ "$PLATFORM" = "arm64" ]; then
  echo "Compiling arm64 slice..."
  xcrun -sdk macosx swiftc -target arm64-apple-macosx12.0 helper/SelectedText.swift -o helper/selectedtext
elif [ "$PLATFORM" = "x64" ]; then
  echo "Compiling x86_64 slice..."
  xcrun -sdk macosx swiftc -target x86_64-apple-macosx12.0 helper/SelectedText.swift -o helper/selectedtext
else
  echo "Unsupported platform: $PLATFORM"
  exit 1
fi

chmod +x helper/selectedtext
echo "Built: helper/selectedtext"

# Print arch info for verification
lipo -info helper/selectedtext || file helper/selectedtext
