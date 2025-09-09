#!/usr/bin/env zsh
#
# usage: ./scripts/release.sh <version|patch|minor|major> <tag>
# e.g.: ./scripts/release.sh patch v0.1.5

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

usage() {
  echo "Usage: $0 <version|patch|minor|major> <tag>"
  echo "  <version|patch|minor|major>  - semver version (1.2.3) or bump keyword"
  echo "  <tag>                       - annotated git tag to create, e.g. v1.2.3"
  exit 2
}

if [ "$#" -lt 2 ]; then
  usage
fi

VERSION_ARG=$1
TAG=$2

echo "==> Checking working tree is clean"
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree has uncommitted changes. Please commit or stash them before running this script." >&2
  git status --porcelain
  exit 1
fi

echo "==> Switch to main"
git checkout main

echo "==> Pull latest changes from origin/main"
git pull --ff-only origin main

echo "==> Bump package.json version: $VERSION_ARG"
# Use npm to update package.json without creating git tag/commit
if [[ "$VERSION_ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-.+)?$ ]] || [[ "$VERSION_ARG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  # If version starts with v, strip it for npm
  NPM_VER=${VERSION_ARG#v}
  npm version "$NPM_VER" --no-git-tag-version
else
  npm version "$VERSION_ARG" --no-git-tag-version
fi

echo "==> Install to update package-lock.json"
npm install

echo "==> Commit package.json and package-lock.json"
git add package.json package-lock.json || true
git commit -m "chore(release): bump version to $(node -p "require('./package.json').version")"

echo "==> Create annotated tag: $TAG"
git tag -a "$TAG" -m "release $TAG"

echo "==> Push tags"
git push origin "$TAG"

echo "==> Done. Released $TAG."
echo "==> Next, manually push commit to main: git push origin main"
