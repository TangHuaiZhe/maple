#!/bin/bash

SOURCE_DIR="$1"
MAX_WIDTH="${2:-800}"
QUALITY="${3:-80}"

if [ -z "$SOURCE_DIR" ]; then
  echo "Usage: $0 <source_dir> [max_width] [quality]"
  echo "Example: $0 ./data-source/Resource/园艺/raw/mrmaple-images 800 80"
  exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: Directory not found: $SOURCE_DIR"
  exit 1
fi

TEMP_DIR="${SOURCE_DIR}_original"

if [ -d "$TEMP_DIR" ]; then
  echo "Compression already done. Original files in: $TEMP_DIR"
  exit 0
fi

echo "Backing up originals to: $TEMP_DIR"
cp -r "$SOURCE_DIR" "$TEMP_DIR"

echo "Compressing images in: $SOURCE_DIR"
echo "Max width: ${MAX_WIDTH}px, Quality: ${QUALITY}%"

COUNT=0
TOTAL=$(find "$SOURCE_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) | wc -l | tr -d ' ')
echo "Total files to process: $TOTAL"

while IFS= read -r file; do
  COUNT=$((COUNT + 1))
  
  WIDTH=$(sips -g pixelWidth "$file" 2>/dev/null | grep pixelWidth | awk '{print $2}')
  
  if [ -n "$WIDTH" ] && [ "$WIDTH" -gt "$MAX_WIDTH" ]; then
    sips -Z "$MAX_WIDTH" "$file" --out "$file.tmp" >/dev/null 2>&1
    if [ -f "$file.tmp" ]; then
      mv "$file.tmp" "$file"
    fi
  fi
  
  EXT="${file##*.}"
  if [ "$EXT" = "jpg" ] || [ "$EXT" = "jpeg" ]; then
    sips -s formatOptions "$QUALITY" "$file" --out "$file.tmp" >/dev/null 2>&1
    if [ -f "$file.tmp" ]; then
      mv "$file.tmp" "$file"
    fi
  fi
  
  if [ $((COUNT % 100)) -eq 0 ]; then
    echo "Progress: $COUNT/$TOTAL"
  fi
done < <(find "$SOURCE_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \))

echo "Done! Processed $COUNT files."
echo "Original files backed up to: $TEMP_DIR"
