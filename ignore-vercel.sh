#!/bin/bash

# Vercel ignore build step script
# Configured here: https://vercel.com/fluxgit/fluxgit-web/settings/git
# Script checks if there are changes in specific directories
# Exit code 0 = skip build, Exit code 1 = proceed

echo "🔍 Checking for changes in monitored directories..."

# Directories to monitor for changes
MONITORED_PATHS=(
  # webapp source
  "apps/web"
  "packages/shared" 
  "packages/core"
  # dependency changes that may affect webapp
  "package.json"
  "pnpm-lock.yaml"
  # the install script is bundled in the webapp
  "scripts/install.sh"
)

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ Not in a git repository. Proceeding with build."
  exit 1
fi

# Get the previous commit SHA
if [ -n "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  PREVIOUS_COMMIT="$VERCEL_GIT_PREVIOUS_SHA"
  echo "📊 Using Vercel previous deployment SHA: $PREVIOUS_COMMIT"
elif git rev-parse --verify HEAD^ > /dev/null 2>&1; then
  PREVIOUS_COMMIT="HEAD^"
  echo "📊 Using previous commit (HEAD^) as fallback"
else
  echo "⚠️  No previous commit reference found. Proceeding with build."
  exit 1
fi

# Verify the previous commit exists in the repository
if ! git rev-parse --verify "$PREVIOUS_COMMIT" > /dev/null 2>&1; then
  echo "⚠️  Previous commit $PREVIOUS_COMMIT not found in repository. Proceeding with build."
  exit 1
fi

echo "📊 Comparing $PREVIOUS_COMMIT with HEAD"

# Check each monitored path for changes
HAS_CHANGES=false

for path in "${MONITORED_PATHS[@]}"; do
  if [ -d "$path" ] || [ -f "$path" ]; then
    if ! git diff --quiet "$PREVIOUS_COMMIT" HEAD -- "$path"; then
      echo "✅ Changes detected in: $path"
      HAS_CHANGES=true
    else
      echo "➖ No changes in: $path"
    fi
  else
    echo "⚠️  No such file or directory: $path"
  fi
done

echo ""

if [ "$HAS_CHANGES" = true ]; then
  echo "🚀 Changes detected in monitored paths. Proceeding with build."
  exit 1  # Build
else
  echo "🛑 No relevant changes detected. Skipping build."
  exit 0  # Skip build
fi

