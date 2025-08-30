#!/bin/bash

set -e

export NODE_ENV=production

echo "Cleaning build folders..."
rm -rf dist build

echo "Building helper binary..."
npm run build:helper

echo "Building TypeScript and Vite app..."
npm run build:main
npm run build:render

if [ "$1" = "--arm64" ]; then
  PLATFORM="arm64"
elif [ "$1" = "--x64" ]; then
  PLATFORM="x64"
else
  # Auto-detect platform if not specified
  ARCH=$(uname -m)
  if [ "$ARCH" = "arm64" ]; then
    PLATFORM="arm64"
  else
    PLATFORM="x64"
  fi
fi

echo "Building Electron app for $PLATFORM..."
electron-builder --mac --$PLATFORM --config electron-builder.json

echo "Build complete!"