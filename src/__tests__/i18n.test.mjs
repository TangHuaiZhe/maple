import test from "node:test";
import assert from "node:assert/strict";

import { UI_STRINGS } from "../i18n.mjs";

test("UI_STRINGS exposes Chinese and English navigation labels", () => {
  assert.equal(UI_STRINGS.zh.nav.catalog, "品种目录");
  assert.equal(UI_STRINGS.en.nav.catalog, "Catalog");
  assert.equal(UI_STRINGS.zh.localeName, "中");
  assert.equal(UI_STRINGS.en.localeName, "EN");
});
