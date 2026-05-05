import test from "node:test";
import assert from "node:assert/strict";

import {
  RHS_FIELD_LABELS,
  getChineseAliases,
  getDetailTraits,
  getLocalizedRhsValue,
  getSizeSummary,
  translateRhsMeasurement,
  translateRhsValue,
} from "../rhsUtils.mjs";

test("translateRhsValue translates comma separated RHS values for Chinese UI", () => {
  assert.equal(translateRhsValue("Full Sun, Partial Shade"), "全日照、半阴");
  assert.equal(translateRhsValue("已翻译"), "已翻译");
});

test("translateRhsMeasurement localizes English measurement words", () => {
  assert.equal(translateRhsMeasurement("2.5-4 metres in 10-20 years"), "2.5-4 米 in 10-20 年");
  assert.equal(translateRhsMeasurement("3 米"), "3 米");
});

test("getLocalizedRhsValue returns English fallback for English locale and translated fallback for Chinese locale", () => {
  assert.equal(getLocalizedRhsValue("en", "", "Full Sun"), "Full Sun");
  assert.equal(getLocalizedRhsValue("zh", "", "Full Sun"), "全日照");
  assert.equal(getLocalizedRhsValue("zh", "", "2-4 metres", { measurement: true }), "2-4 米");
});

test("getSizeSummary formats localized dimensions", () => {
  const rhs = {
    dimensions: {
      height: "2-4 metres",
      spread: "1-1.5 metres",
      time_to_full_height: "10-20 years",
    },
  };

  assert.equal(getSizeSummary(rhs, rhs, "zh"), "高 2-4 米 · 冠幅 1-1.5 米 · 10-20 年 达到成株尺寸");
  assert.equal(getSizeSummary(rhs, rhs, "en"), "H 2-4 metres · W 1-1.5 metres · 10-20 years to mature size");
});

test("getDetailTraits returns RHS chips with locale labels", () => {
  const item = {
    rhs: {
      attributes: {
        habit: "Bushy",
        plant_type: "Shrub",
        foliage: "Deciduous",
      },
      dimensions: {
        height: "2 metres",
      },
    },
  };

  assert.deepEqual(getDetailTraits(item, "zh", RHS_FIELD_LABELS.zh), [
    "株型：丛生型",
    "植物类型：灌木",
    "落叶/常绿：落叶",
    "高 2 米",
  ]);
});

test("getChineseAliases filters non-Chinese aliases and current Chinese name", () => {
  assert.deepEqual(getChineseAliases({
    chinese_name: "血红",
    aliases: ["Bloodgood", "血红", "深红"],
    search_terms: ["鸡爪槭", "Acer palmatum", "红枫Acer"],
  }), ["深红", "鸡爪槭"]);
});
