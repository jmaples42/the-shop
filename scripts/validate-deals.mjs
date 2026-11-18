#!/usr/bin/env node
// Checks a weekly deals file against the format in docs/DATA_FORMAT.md.
// Usage: node scripts/validate-deals.mjs public/data/current.json
// Exits non-zero with a list of problems, so a bad file never ships.
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: validate-deals.mjs <file.json>");
  process.exit(2);
}
let d;
try {
  d = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error(`${file}: not valid JSON: ${e.message}`);
  process.exit(1);
}

const errs = [];
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const need = (cond, msg) => {
  if (!cond) errs.push(msg);
};

need(d.schemaVersion === 1, "schemaVersion must be 1");
need(isDate(d.edition), "edition must be YYYY-MM-DD");
need(isStr(d.title), "title is required");
need(isStr(d.area), "area is required");
need(isStr(d.generatedAt) && !Number.isNaN(Date.parse(d.generatedAt)), "generatedAt must be an ISO timestamp");
for (const k of ["stores", "deals", "best", "staples", "compare", "gaps", "sources"]) need(Array.isArray(d[k]), `${k} must be an array`);
if (errs.length) finish();

const storeIds = new Set();
d.stores.forEach((s, i) => {
  const at = `stores[${i}]`;
  need(isStr(s.id) && /^[a-z0-9-]+$/.test(s.id), `${at}.id must be a lowercase slug`);
  need(!storeIds.has(s.id), `${at}.id "${s.id}" is duplicated`);
  storeIds.add(s.id);
  need(isStr(s.name), `${at}.name is required`);
  need(isStr(s.dates), `${at}.dates is required`);
  need(["sale", "regular", "none"].includes(s.priceType), `${at}.priceType must be sale, regular or none`);
  if (s.adStart !== undefined) need(isDate(s.adStart), `${at}.adStart must be YYYY-MM-DD`);
  if (s.adEnd !== undefined) need(isDate(s.adEnd), `${at}.adEnd must be YYYY-MM-DD`);
  if (s.notes !== undefined) need(Array.isArray(s.notes) && s.notes.every(isStr), `${at}.notes must be strings`);
});

const dealIds = new Set();
d.deals.forEach((x, i) => {
  const at = `deals[${i}] (${x?.id ?? "?"})`;
  need(isStr(x.id), `${at}.id is required`);
  need(!dealIds.has(x.id), `${at}.id is duplicated`);
  dealIds.add(x.id);
  need(storeIds.has(x.storeId), `${at}.storeId "${x.storeId}" is not in stores`);
  need(isStr(x.department), `${at}.department is required`);
  need(isStr(x.name), `${at}.name is required`);
  need(isStr(x.price), `${at}.price is required`);
  for (const k of ["conditions", "regularPrice"]) if (x[k] !== undefined) need(isStr(x[k]), `${at}.${k} must be a non-empty string`);
  if (x.unverified !== undefined) need(typeof x.unverified === "boolean", `${at}.unverified must be true/false`);
});

d.best.forEach((b, i) => need(dealIds.has(b.dealId), `best[${i}].dealId "${b.dealId}" is not in deals`));
d.staples.forEach((s, i) => {
  need(isStr(s.item) && isStr(s.cheapest) && isStr(s.others), `staples[${i}] needs item, cheapest, others`);
  if (s.cheapestStoreId !== undefined) need(storeIds.has(s.cheapestStoreId), `staples[${i}].cheapestStoreId not in stores`);
});
d.compare.forEach((c, i) => {
  need(isStr(c.item), `compare[${i}].item is required`);
  need(c.prices && typeof c.prices === "object", `compare[${i}].prices must be an object`);
  for (const k of Object.keys(c.prices ?? {})) need(storeIds.has(k), `compare[${i}].prices key "${k}" not in stores`);
});
d.sources.forEach((s, i) => need(isStr(s.label), `sources[${i}].label is required`));
need(d.deals.length > 0, "deals is empty");

finish();
function finish() {
  if (errs.length) {
    console.error(`${file}: ${errs.length} problem(s)`);
    for (const e of errs.slice(0, 50)) console.error("  - " + e);
    process.exit(1);
  }
  console.log(`${file}: OK (${d.stores.length} stores, ${d.deals.length} deals)`);
}
