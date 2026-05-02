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

## Recommended Next Step

Do not rewrite originals. Add generated thumbnails beside the current assets and keep original paths for detail lightbox views.

Suggested target layout:

```text
public/thumbs/{source-dir}/{cultivar-id}/{file-base}-w480.webp
public/thumbs/{source-dir}/{cultivar-id}/{file-base}-w960.webp
```

Suggested usage:

- Catalog cards: `w480`
- Detail hero and featured gallery tile: `w960`
- Lightbox/full-size preview: original image path

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

Then verify a few representative pages:

- A popular cultivar with many Mr Maple images
- A user-uploaded image cultivar
- A cultivar with RHS imagery

Only switch UI rendering to thumbnails after the generated files and data mapping are verified.
