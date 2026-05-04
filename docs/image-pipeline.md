# Image Pipeline Notes

## Current Audit

Run:

```bash
npm run image:audit
```

Current result:

- 6198 image files
- 983.3 MB total
- `mrmaple-images`: 5556 files, 830.3 MB
- `coniferkingdom-images`: 121 files, 51.7 MB
- `rhs-images`: 279 files, 45.1 MB
- `jmac-images`: 140 files, 44.7 MB
- `user-images`: 22 files, 5.0 MB
- `herter-images`: 74 files, 4.0 MB
- `ncsu-images`: 6 files, 2.4 MB

## Thumbnail Generation

Do not rewrite originals. Generated thumbnails live beside the current assets, and original paths should stay available for detail lightbox views.

Target layout:

```text
public/thumbs/{source-dir}/{cultivar-id}/{file-base}-w480.webp
public/thumbs/{source-dir}/{cultivar-id}/{file-base}-w960.webp
```

Suggested usage:

- Catalog cards: `w480`
- Detail hero and featured gallery tile: `w960`
- Lightbox/full-size preview: original image path

Preview the generation plan without writing files:

```bash
npm run image:thumbs
npm run image:thumbs -- --source-dir=mrmaple-images
```

Generate thumbnails:

```bash
npm run image:thumbs:write -- --source-dir=mrmaple-images
npm run image:thumbs:write -- --source-dir=mrmaple-images --limit=100
```

The write command also updates `public/data/image-thumbs.json`. The Web app only uses thumbnail URLs listed in this manifest; missing entries automatically fall back to original image URLs. The detail lightbox always uses originals.

Useful options:

- `--source-dir=mrmaple-images` limits work to one public image directory
- `--sizes=480,960` changes generated widths
- `--min-source-bytes=256000` changes the non-cover skip threshold
- `--all` includes unreferenced and small source images
- `--limit=100` caps planned/generated jobs for incremental batches

## Generation Criteria

Start with the highest impact set:

1. Generate thumbnails only for images referenced by `catalog.json` and `details/*.json`.
2. Prioritize `mrmaple-images` first because it accounts for most storage.
3. Skip source files smaller than 250 KB unless they are cover images.
4. Keep generated thumbnails out of `data-source`; treat them as public build artifacts.

## Validation Criteria

After thumbnail generation:

```bash
npm run image:audit
npm run check:build
```

Deploy generated thumbnails after build:

```bash
npm run build
npm run deploy:cloudbase:image-thumbs
```

Then verify a few representative pages:

- A popular cultivar with many Mr Maple images
- A user-uploaded image cultivar
- A cultivar with RHS imagery

Only switch UI rendering to thumbnails after the generated files and data mapping are verified.
