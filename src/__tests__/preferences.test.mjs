import test from "node:test";
import assert from "node:assert/strict";

import {
  DISCOVERY_VISIBILITY_STORAGE_KEY,
  readDiscoveryVisibility,
  writeDiscoveryVisibility,
} from "../preferences.mjs";

function memoryStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem(key) {
      assert.equal(key, DISCOVERY_VISIBILITY_STORAGE_KEY);
      return value;
    },
    setItem(key, nextValue) {
      assert.equal(key, DISCOVERY_VISIBILITY_STORAGE_KEY);
      value = nextValue;
    },
    value() {
      return value;
    },
  };
}

test("readDiscoveryVisibility reads enabled state from storage", () => {
  assert.equal(readDiscoveryVisibility(memoryStorage("1")), true);
  assert.equal(readDiscoveryVisibility(memoryStorage("0")), false);
  assert.equal(readDiscoveryVisibility(null), false);
});

test("writeDiscoveryVisibility stores enabled state as 1 or 0", () => {
  const storage = memoryStorage();

  writeDiscoveryVisibility(true, storage);
  assert.equal(storage.value(), "1");

  writeDiscoveryVisibility(false, storage);
  assert.equal(storage.value(), "0");
});
