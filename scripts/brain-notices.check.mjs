// 실행: node --experimental-strip-types scripts/brain-notices.check.mjs  (KSTARTUP_API_KEY 있으면 실제 API도 확인)
import assert from "node:assert/strict";
import { formatDate, mapRegion, parseKstartupItems, kstartupToRow, fetchKstartup, isAgeEligible, businessYears, calculateMatchScore } from "../src/lib/brain/notices.ts";

assert.equal(formatDate("20261204"), "2026-12-04");
assert.equal(formatDate(""), null);
assert.equal(mapRegion("경기", "안산시 청년 창업", "경기도"), "안산");
assert.equal(mapRegion("", "전국 공모", "창업진흥원"), "전국");

// 업력 조건
assert.equal(isAgeEligible(null, 8), true);
assert.equal(isAgeEligible("예비창업자,1년미만,7년미만", 8.4), false);
assert.equal(isAgeEligible("7년미만,10년미만", 8.4), true);
assert.equal(isAgeEligible("예비창업자", 8.4), false);
assert.equal(isAgeEligible("3년미만", null), null);
assert.ok(Math.abs(businessYears("2018-07-09", new Date("2026-07-09")) - 8) < 0.01);

// 점수: 업력 미충족은 20점 이하, 탐색 지역 밖은 감점, 행사는 사업화보다 낮음
const profile = { founded: "2018-07-09", target_regions: ["서울", "안산", "전국"], biz_types: ["모델/엔터테인먼트", "라이브커머스"] };
const base = { title: "공고", region: "서울", category: "사업화", org: "", description: "" };
assert.ok(calculateMatchScore(base, false, profile) <= 20);
assert.ok(calculateMatchScore({ ...base, region: "인천" }, true, profile) < calculateMatchScore(base, true, profile));
assert.ok(calculateMatchScore({ ...base, category: "행사ㆍ네트워크" }, true, profile) < calculateMatchScore(base, true, profile));
assert.ok(calculateMatchScore({ ...base, title: "모델 라이브커머스 지원" }, true, profile) > calculateMatchScore(base, true, profile));

const xml = `<results><data><item><col name="pbanc_sn">1</col><col name="biz_pbanc_nm">A &amp;amp; B&#xA;공모</col><col name="supt_regin">서울</col><col name="pbanc_rcpt_end_dt">20261231</col><col name="biz_enyy">1년미만,3년미만</col></item><item><col name="biz_pbanc_nm">번호없음</col></item></data></results>`;
const items = parseKstartupItems(xml);
assert.equal(items.length, 2);
assert.equal(items[0].biz_pbanc_nm, "A & B\n공모");
const row = kstartupToRow(items[0], profile);
assert.equal(row.region, "서울");
assert.equal(row.deadline, "2026-12-31");
assert.equal(row.eligible, false);
assert.equal(kstartupToRow(items[1]), null);
console.log("parser/score OK");

if (process.env.KSTARTUP_API_KEY) {
  const rows = await fetchKstartup(process.env.KSTARTUP_API_KEY, profile);
  assert.ok(rows.length > 0);
  assert.equal(new Set(rows.map((r) => r.external_id)).size, rows.length);
  const ok = rows.filter((r) => r.eligible !== false);
  console.log("live OK:", rows.length, "rows,", ok.length, "eligible. top 8:");
  for (const r of ok.sort((a, b) => b.match_score - a.match_score).slice(0, 8)) console.log(" ", r.match_score, r.category, r.region, r.title.slice(0, 40));
}
