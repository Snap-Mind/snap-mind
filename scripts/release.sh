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

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "==> Operating on current branch: $CURRENT_BRANCH"

echo "==> Fetch & fast-forward (if possible) current branch from origin/$CURRENT_BRANCH"
git fetch origin "$CURRENT_BRANCH" || true
if git rev-parse --verify "origin/$CURRENT_BRANCH" >/dev/null 2>&1; then
  # Cases:
  # 1) origin is ancestor of HEAD  -> local ahead (ok)
  # 2) HEAD is ancestor of origin  -> need fast-forward
  # 3) Diverged                    -> abort
  if git merge-base --is-ancestor "origin/$CURRENT_BRANCH" HEAD; then
    echo "==> Local is ahead of origin/$CURRENT_BRANCH (no fast-forward needed)"
  elif git merge-base --is-ancestor HEAD "origin/$CURRENT_BRANCH"; then
    echo "==> Fast-forwarding to origin/$CURRENT_BRANCH"
    git merge --ff-only "origin/$CURRENT_BRANCH"
  else
    echo "ERROR: Branch has diverged from origin/$CURRENT_BRANCH. Please reconcile (pull/rebase) before releasing." >&2
    exit 1
  fi
else
  echo "==> Remote branch origin/$CURRENT_BRANCH does not exist yet (will be created on push)."
fi

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

# echo "==> Push branch commits"
# git push

# echo "==> Push tag"
# git push origin "$TAG"

echo "==> Done. Released $TAG on branch $CURRENT_BRANCH."
