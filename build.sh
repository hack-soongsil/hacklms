#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

for target in chrome safari; do
    output="$root/dist/$target"

    rm -rf -- "$output"
    mkdir -p -- "$output"

    cp -- "$root/manifest-$target.json" "$output/manifest.json"
    cp -R -- "$root/src" "$root/images" "$output/"

    echo "빌드 완료: $output"
done