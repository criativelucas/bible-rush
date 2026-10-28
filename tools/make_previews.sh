#!/bin/sh
# Setup-screen map previews: encodes the frames dev.film() rendered (shots/film/<map>/) into assets/maps/<map>.mp4.
# In the browser, for each map: open /?biome=<map>, then run `await dev.film()` in the console.
set -e
cd "$(dirname "$0")/.."
mkdir -p assets/maps
for dir in shots/film/*/; do
  id=$(basename "$dir")
  ffmpeg -y -loglevel error -framerate 24 -i "$dir%04d.jpg" -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p \
    -movflags +faststart -an "assets/maps/$id.mp4"
  echo "assets/maps/$id.mp4 $(du -h "assets/maps/$id.mp4" | cut -f1)"
done
