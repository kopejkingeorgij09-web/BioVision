#!/bin/bash
set -euo pipefail
source_dir="$(cd "$(dirname "$0")/.." && pwd)"
destination="$source_dir/dist"
if [[ $# -gt 0 ]]; then destination="$1"; fi
app="$destination/Polya.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources/Web"
cp "$source_dir/macos/Info.plist" "$app/Contents/Info.plist"
bash "$source_dir/scripts/bundle-web.sh" "$app/Contents/Resources/Web"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
for arch in arm64 x86_64; do
  xcrun swiftc -O -target "$arch-apple-macosx13.0" -module-cache-path "$tmp/swift-cache" \
    "$source_dir/macos/Notes.swift" -o "$tmp/Polya-$arch"
done
xcrun lipo -create "$tmp/Polya-arm64" "$tmp/Polya-x86_64" -output "$app/Contents/MacOS/Polya"
codesign --force --sign - "$app"
codesign --verify --strict "$app"
ditto -c -k --sequesterRsrc --keepParent "$app" "$destination/Polya-macOS.zip"
