#!/bin/sh
# Rebuilds every 3D model with Blender (headless): heroes from their sprites, then mobs, bosses,
# relics, weapons and scenery. Outputs go to assets/models/*.glb and assets/blender/*.blend.
#   sh tools/build_models.sh
set -e
cd "$(dirname "$0")/.."
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
"$BLENDER" -b --factory-startup -P tools/blender/heroes.py
"$BLENDER" -b --factory-startup -P tools/blender/assets.py
