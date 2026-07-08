#!/usr/bin/env bash
# Vendors the contract artefacts the frontend depends on (error codes, pricing vectors).
# Usage: scripts/sync-contract-artifacts.sh [path-to-contracts-repo | git-ref]
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:-../sorobanpool-contracts}"
mkdir -p lib/errors tests/fixtures
if [ -d "$SRC" ]; then
  cp "$SRC/artifacts/errors.json" lib/errors/errors.json
  cp "$SRC/vectors/pricing-vectors.json" tests/fixtures/pricing-vectors.json
else
  base="https://raw.githubusercontent.com/SorobanPool/sorobanpool-contracts/$SRC"
  curl -fsSL "$base/artifacts/errors.json" -o lib/errors/errors.json
  curl -fsSL "$base/vectors/pricing-vectors.json" -o tests/fixtures/pricing-vectors.json
fi
echo "synced from $SRC"
