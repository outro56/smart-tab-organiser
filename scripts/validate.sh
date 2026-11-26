#!/bin/sh
set -eu

for source in extension/*.js; do
  node --check "$source"
done
node --test tests/*.test.js
python3 scripts/validate-store-assets.py
python3 scripts/build-release.py
printf '%s\n' "Release validation passed."
