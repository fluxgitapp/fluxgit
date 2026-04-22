#!/usr/bin/env bash
set -eu -o pipefail
CLI=${1:?The first argument is the FluxGit CLI}

git init remote
(cd remote
  echo first > file
  git add . && git commit -m "init"
)

export FLUXGIT_CLI_DATA_DIR=../user/fluxgit/app-data
git clone remote workspace-migration
(cd workspace-migration
  $CLI project add --switch-to-workspace "$(git rev-parse --symbolic-full-name @{u})"
  $CLI branch create virtual
  # Start the test on the old integration branch.
  git checkout -b fluxgit/integration
)
