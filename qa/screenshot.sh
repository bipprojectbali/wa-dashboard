#!/usr/bin/env bash
# qa/screenshot.sh — wrapper agent-browser screenshot dengan path terstruktur
#
# Usage:
#   qa/screenshot.sh <nama> [subdir] [sesi]
#
# Argumen:
#   nama    — nama file tanpa ekstensi (wajib). Contoh: BUG-003, TC-017-step1
#   subdir  — subfolder dalam screenshots/ (default: evidence)
#             Pilihan: discovery/desktop, discovery/mobile, evidence, passed
#   sesi    — folder sesi qa/YYYY-MM-DD (default: tanggal hari ini)
#
# Contoh:
#   qa/screenshot.sh BUG-003                              → qa/2026-06-16/screenshots/evidence/BUG-003.png
#   qa/screenshot.sh admin-home discovery/desktop         → qa/2026-06-16/screenshots/discovery/desktop/admin-home.png
#   qa/screenshot.sh TC-017 passed                        → qa/2026-06-16/screenshots/passed/TC-017.png
#   qa/screenshot.sh admin-home discovery/desktop 2026-06-16-02   → sesi kedua hari ini

set -euo pipefail

NAME="${1:?Usage: qa/screenshot.sh <nama> [subdir] [sesi]}"
SUBDIR="${2:-evidence}"
SESSION="${3:-$(date +%Y-%m-%d)}"

OUT_DIR="qa/$SESSION/screenshots/$SUBDIR"
mkdir -p "$OUT_DIR"

OUT_PATH="$OUT_DIR/$NAME.png"
agent-browser screenshot "$OUT_PATH"

echo "✓ screenshot → $OUT_PATH"
