#!/bin/bash
set -euo pipefail
if [[ $# -ne 1 ]]; then printf 'Usage: %s OUTPUT_DIRECTORY\n' "$0" >&2; exit 2; fi
source_dir="$(cd "$(dirname "$0")/.." && pwd)"
output="$1"
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
cache="$(printenv NOTES_VENDOR_CACHE || true)"
if [[ -z "$cache" ]]; then cache="$temp"; fi
mkdir -p "$output/vendor/pdfjs" "$output/vendor/katex"

package() {
  local name="$1" url="$2" checksum="$3"
  if [[ ! -f "$cache/$name.tgz" ]]; then
    curl --fail --silent --show-error --location --retry 2 "$url" -o "$cache/$name.tgz"
  fi
  printf '%s  %s\n' "$checksum" "$cache/$name.tgz" | shasum -a 256 --check --status
  mkdir -p "$temp/$name"
  tar -xzf "$cache/$name.tgz" --strip-components 1 -C "$temp/$name"
}
package katex https://registry.npmjs.org/katex/-/katex-0.19.1.tgz 24da5a599eb2fcede2e270b99a6ff48bca816beecc95feeb84e8cccbd1bb34fd

for item in js style.css icon.svg manifest.webmanifest sw.js; do cp -R "$source_dir/$item" "$output/"; done
sed -e 's/<html lang="ru">/<html lang="ru" data-bundled="true">/' \
    -e 's|https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/|vendor/katex/|g' \
    "$source_dir/index.html" > "$output/index.html"
# PDF.js 6.5.438 лежит в репозитории; перед копированием сверяем контрольные суммы.
(cd "$source_dir/vendor/pdfjs" && shasum -a 256 --check --status SHA256SUMS)
cp -R "$source_dir/vendor/pdfjs/." "$output/vendor/pdfjs/"
for item in katex.min.js katex.min.css fonts; do cp -R "$temp/katex/dist/$item" "$output/vendor/katex/"; done
cp "$temp/katex/LICENSE" "$output/vendor/katex/"
