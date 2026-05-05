# Optimization Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reduce maintenance friction in the Web app while strengthening data consistency checks.

**Architecture:** Keep runtime behavior unchanged. Move static UI copy out of the large app component, use the existing generated awards data as the Web source of truth, and add focused Node tests around data integrity helpers before implementation.

**Tech Stack:** React 19, Vite, ES modules, Node test runner, JSON data under `public/data`.

---

## File Structure

- Create: `src/i18n.mjs` — exports `UI_STRINGS`.
- Modify: `src/dataUtils.mjs` — adds `loadAwardRecords()` for on-demand award data loading.
- Create: `src/cultivarViewUtils.mjs` — owns pure cultivar display helpers for search, sorting, descriptions, covers, and summaries.
- Create: `src/devEditorUtils.mjs` — owns pure dev-editor JSON field picking, validation, and merging.
- Create: `src/rhsUtils.mjs` — owns RHS translation, measurement, detail trait, and Chinese alias helpers.
- Create: `src/awardsUtils.mjs` — owns award record overlay logic.
- Create: `src/preferences.mjs` — owns localStorage-backed UI preferences.
- Modify: `src/App.jsx` — imports `UI_STRINGS`, removes duplicate RHS award constants, loads `public/data/awards.json` only on the awards page.
- Modify: `scripts/check-data.mjs` — adds checks for detail filename/id alignment and curated ID references.
- Modify: `scripts/__tests__/check-data.test.mjs` — covers new data checks.
- Use existing: `public/data/awards.json`, `public/data/popular-ids.json`, `public/data/catalog.json`.

### Task 1: Extract UI Strings

**Files:**
- Create: `src/i18n.mjs`
- Modify: `src/App.jsx`
- Test: `src/__tests__/i18n.test.mjs`

- [x] **Step 1: Write the failing test**

Create `src/__tests__/i18n.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { UI_STRINGS } from "../i18n.mjs";

test("UI_STRINGS exposes Chinese and English navigation labels", () => {
  assert.equal(UI_STRINGS.zh.nav.catalog, "品种目录");
  assert.equal(UI_STRINGS.en.nav.catalog, "Catalog");
  assert.equal(UI_STRINGS.zh.localeName, "中");
  assert.equal(UI_STRINGS.en.localeName, "EN");
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test src/__tests__/i18n.test.mjs`

Expected: fail because `src/i18n.mjs` does not exist.

- [x] **Step 3: Move the existing `UI_STRINGS` object**

Move the full `UI_STRINGS` object from `src/App.jsx` into `src/i18n.mjs` and export it:

```js
export const UI_STRINGS = {
  zh: {
    localeName: "中",
    nav: {
      catalog: "品种目录",
      popular: "流行品种",
      awards: "RHS 获奖",
      favorites: "收藏",
    },
    // keep the remaining existing strings unchanged
  },
  en: {
    localeName: "EN",
    nav: {
      catalog: "Catalog",
      popular: "Popular",
      awards: "RHS Awards",
      favorites: "Favorites",
    },
    // keep the remaining existing strings unchanged
  },
};
```

Then add to `src/App.jsx`:

```js
import { UI_STRINGS } from "./i18n.mjs";
```

- [x] **Step 4: Run the focused test**

Run: `node --test src/__tests__/i18n.test.mjs`

Expected: pass.

### Task 2: Use Awards Data File in Web UI

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/dataUtils.mjs`
- Test: `src/__tests__/dataUtils.test.mjs`
- Use: `public/data/awards.json`

- [x] **Step 1: Write the failing loader test**

Add a `loadAwardRecords()` test to `src/__tests__/dataUtils.test.mjs`:

```js
test("loadAwardRecords loads awards data through the app URL resolver", async () => {
  const calls = [];
  const records = await loadAwardRecords({
    fetchImpl: (url, options) => {
      calls.push([url, options]);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: "acer-palmatum-bloodgood" }]),
      });
    },
    baseUrl: "/maple/",
    cacheBust: "test-build",
  });

  assert.deepEqual(calls, [
    ["/maple/data/awards.json?v=test-build", { cache: "no-store" }],
  ]);
  assert.deepEqual(records, [{ id: "acer-palmatum-bloodgood" }]);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test src/__tests__/dataUtils.test.mjs`

Expected: fail because `loadAwardRecords()` is not exported.

- [x] **Step 3: Implement on-demand awards loading**

Add to `src/dataUtils.mjs`:

```js
export function loadAwardRecords({
  fetchImpl = globalThis.fetch,
  baseUrl = APP_BASE_URL,
  cacheBust = DEPLOY_CACHE_BUST,
} = {}) {
  return fetchImpl(resolveAppUrl("/data/awards.json", { baseUrl, cacheBust }), { cache: "no-store" }).then((response) => {
    if (!response.ok) {
      throw new Error("无法加载 awards.json");
    }
    return response.json();
  });
}
```

- [x] **Step 4: Remove the hard-coded `RHS_AWARD_SELECTIONS` array**

Delete the local constant from `src/App.jsx`.

- [x] **Step 5: Build award selections from fetched data**

Replace the page mapping source with:

```js
const [awardRecords, setAwardRecords] = useState([]);
const resolvedSelections = awardRecords
  .map((selection) => {
    const record = recordMap.get(selection.id);
    if (!record) return null;
    return {
      ...record,
      awardDisplayName: selection.display_name || selection.canonical_name || record.display_name,
      awardChineseName: selection.chinese_name || record.chinese_name,
      awardGroup: selection.award_group || null,
    };
  })
  .filter(Boolean);
```

- [x] **Step 6: Run focused and build verification**

Run: `node --test src/__tests__/dataUtils.test.mjs && npm run build`

Expected: focused tests pass and Vite build succeeds without adding `awards.json` to the main JS bundle.

### Task 3: Strengthen Data Checks

**Files:**
- Modify: `scripts/check-data.mjs`
- Modify: `scripts/__tests__/check-data.test.mjs`

- [x] **Step 1: Write failing tests**

Add tests for:

```js
checkDetailFileNameMatchesRecordId({
  detailFileRecords: [
    { fileName: "acer-palmatum-good.json", record: { id: "acer-palmatum-good" } },
    { fileName: "acer-palmatum-bad.json", record: { id: "acer-palmatum-other" } },
  ],
});
```

Expected error:

```txt
detail file public/data/details/acer-palmatum-bad.json contains id acer-palmatum-other
```

Add tests for:

```js
checkCuratedIdsExist({
  catalogRecords: [{ id: "acer-palmatum-known" }],
  popularIds: ["acer-palmatum-missing"],
  awardRecords: [{ id: "acer-palmatum-known" }, { id: "acer-palmatum-award-missing" }],
});
```

Expected errors:

```txt
popular id acer-palmatum-missing is missing from public/data/catalog.json
award id acer-palmatum-award-missing is missing from public/data/catalog.json
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/__tests__/check-data.test.mjs`

Expected: fail because the exported functions do not exist.

- [x] **Step 3: Implement checks**

Export:

```js
export function checkDetailFileNameMatchesRecordId({ detailFileRecords }) {
  const check = result();
  for (const { fileName, record } of detailFileRecords || []) {
    const expectedId = fileName.replace(/\.json$/i, "");
    if (record?.id !== expectedId) {
      check.errors.push(`detail file public/data/details/${fileName} contains id ${formatValue(record?.id)}`);
    }
  }
  return check;
}

export function checkCuratedIdsExist({ catalogRecords, popularIds, awardRecords }) {
  const check = result();
  const catalogIds = new Set((catalogRecords || []).map((record) => record.id));
  for (const id of popularIds || []) {
    if (!catalogIds.has(id)) {
      check.errors.push(`popular id ${id} is missing from public/data/catalog.json`);
    }
  }
  for (const record of awardRecords || []) {
    if (!catalogIds.has(record.id)) {
      check.errors.push(`award id ${record.id} is missing from public/data/catalog.json`);
    }
  }
  return check;
}
```

Update `run()` to load `popular-ids.json` and `awards.json`, pass detail filename records, and merge the new checks.

- [x] **Step 4: Run focused tests**

Run: `node --test scripts/__tests__/check-data.test.mjs`

Expected: pass.

### Task 4: Full Verification

**Files:**
- All touched files.

- [x] **Step 1: Run full project check**

Run: `npm run check:build`

Expected: data check passes, all Node tests pass, Vite build succeeds.

- [x] **Step 2: Inspect changed files**

Run: `git status --short && git diff --stat`

Expected: changes limited to the plan doc, `src/App.jsx`, `src/i18n.mjs`, tests, and data check script.

### Task 5: Extract Cultivar View Utilities

**Files:**
- Create: `src/cultivarViewUtils.mjs`
- Modify: `src/App.jsx`
- Test: `src/__tests__/cultivarViewUtils.test.mjs`

- [x] **Step 1: Write failing tests**

Cover `normalizeSearchText`, `isDiscoveryHiddenRecord`, `getVisibleImagePaths`, `getVisibleCover`, `getCoverSourceKey`, `getPreferredDescription`, `summarizeText`, `matchesQuery`, and `getAlphabetSections`.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test src/__tests__/cultivarViewUtils.test.mjs`

Expected: fail because `src/cultivarViewUtils.mjs` does not exist.

- [x] **Step 3: Move pure helpers**

Move the pure helper functions from `src/App.jsx` into `src/cultivarViewUtils.mjs` and export them. Import the used helpers back into `src/App.jsx`.

- [x] **Step 4: Run focused and build verification**

Run: `node --test src/__tests__/cultivarViewUtils.test.mjs && npm run build`

Expected: tests pass and Vite build succeeds.

### Task 6: Extract Dev Editor Utilities

**Files:**
- Create: `src/devEditorUtils.mjs`
- Modify: `src/App.jsx`
- Test: `src/__tests__/devEditorUtils.test.mjs`

- [x] **Step 1: Write failing tests**

Cover `pickEditableRecord`, `assertEditableRecordShape`, and `mergeEditableRecord`, including safe defaults, invalid arrays, invalid description objects, and preserving non-editable fields.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test src/__tests__/devEditorUtils.test.mjs`

Expected: fail because `src/devEditorUtils.mjs` does not exist.

- [x] **Step 3: Move dev editor helpers**

Move the three helper functions from `src/App.jsx` into `src/devEditorUtils.mjs` and import them back into `src/App.jsx`.

- [x] **Step 4: Run focused and build verification**

Run: `node --test src/__tests__/devEditorUtils.test.mjs && npm run build`

Expected: tests pass and Vite build succeeds.

### Task 7: Extract RHS Utilities

**Files:**
- Create: `src/rhsUtils.mjs`
- Modify: `src/App.jsx`
- Test: `src/__tests__/rhsUtils.test.mjs`

- [x] **Step 1: Write failing tests**

Cover RHS value translation, measurement translation, localized fallback, size summary, detail trait chips, and Chinese alias filtering.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test src/__tests__/rhsUtils.test.mjs`

Expected: fail because `src/rhsUtils.mjs` does not exist.

- [x] **Step 3: Move RHS helpers**

Move `RHS_VALUE_TRANSLATIONS`, `RHS_FIELD_LABELS`, `translateRhsValue`, `translateRhsMeasurement`, `getLocalizedRhsValue`, `getSizeSummary`, `getDetailTraits`, and `getChineseAliases` from `src/App.jsx` into `src/rhsUtils.mjs`.

- [x] **Step 4: Run focused and build verification**

Run: `node --test src/__tests__/rhsUtils.test.mjs && npm run build`

Expected: tests pass and Vite build succeeds.

### Task 8: Extract Awards Selection Mapping

**Files:**
- Create: `src/awardsUtils.mjs`
- Modify: `src/App.jsx`
- Test: `src/__tests__/awardsUtils.test.mjs`

- [x] **Step 1: Write failing tests**

Cover overlaying award data onto catalog records, filtering missing IDs, and falling back to catalog names when award names are blank.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test src/__tests__/awardsUtils.test.mjs`

Expected: fail because `src/awardsUtils.mjs` does not exist.

- [x] **Step 3: Move awards mapping**

Create `resolveAwardSelections({ records, awardRecords })` and use it inside `RHSAwardPage`.

- [x] **Step 4: Run focused and build verification**

Run: `node --test src/__tests__/awardsUtils.test.mjs && npm run build`

Expected: tests pass and Vite build succeeds.

### Task 9: Extract UI Preferences

**Files:**
- Create: `src/preferences.mjs`
- Modify: `src/App.jsx`
- Test: `src/__tests__/preferences.test.mjs`

- [x] **Step 1: Write failing tests**

Cover reading and writing the discovery cultivar visibility preference using an injected storage object.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test src/__tests__/preferences.test.mjs`

Expected: fail because `src/preferences.mjs` does not exist.

- [x] **Step 3: Move localStorage helpers**

Move `DISCOVERY_VISIBILITY_STORAGE_KEY`, `readDiscoveryVisibility`, and `writeDiscoveryVisibility` from `src/App.jsx` into `src/preferences.mjs`.

- [x] **Step 4: Run focused and build verification**

Run: `node --test src/__tests__/preferences.test.mjs && npm run build`

Expected: tests pass and Vite build succeeds.
