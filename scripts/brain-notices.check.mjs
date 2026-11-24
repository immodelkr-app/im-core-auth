// 실행: node --experimental-strip-types scripts/brain-notices.check.mjs  (KSTARTUP_API_KEY 있으면 실제 API도 확인)
import assert from "node:assert/strict";
import { formatDate, mapRegion, parseKstartupItems, kstartupToRow, fetchKstartup } from "../src/lib/brain/notices.ts";

assert.equal(formatDate("20261204"), "2026-12-04");
assert.equal(formatDate(""), null);
assert.equal(mapRegion("경기", "안산시 청년 창업", "경기도"), "안산");
assert.equal(mapRegion("", "전국 공모", "창업진흥원"), "전국");

const xml = `<results><data><item><col name="pbanc_sn">1</col><col name="biz_pbanc_nm">A &amp; B&#xA;공모</col><col name="supt_regin">서울</col><col name="pbanc_rcpt_end_dt">20261231</col></item><item><col name="biz_pbanc_nm">번호없음</col></item></data></results>`;
const items = parseKstartupItems(xml);
assert.equal(items.length, 2);
assert.equal(items[0].biz_pbanc_nm, "A & B\n공모");
const row = kstartupToRow(items[0]);
assert.equal(row.region, "서울");
assert.equal(row.deadline, "2026-12-31");
assert.equal(kstartupToRow(items[1]), null);
console.log("parser OK");

if (process.env.KSTARTUP_API_KEY) {
  const rows = await fetchKstartup(process.env.KSTARTUP_API_KEY);
  assert.ok(rows.length > 0);
  assert.equal(new Set(rows.map((r) => r.external_id)).size, rows.length);
  const regions = rows.reduce((a, r) => ({ ...a, [r.region]: (a[r.region] ?? 0) + 1 }), {});
  console.log("live OK:", rows.length, "rows", regions, "sample:", rows[0].title, rows[0].deadline, rows[0].category, rows[0].match_score);
}
