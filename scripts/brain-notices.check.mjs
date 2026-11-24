// 실행: npx -y tsx scripts/brain-notices.check.mjs  (KSTARTUP_API_KEY 있으면 K-Startup, LIVE=1 이면 안산문화재단 실제 사이트도 확인)
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

// ── 안산문화재단 + 문자 알림 ──
const { parseAnsanArtList, ansanArtToRow, fetchAnsanArt } = await import("../src/lib/brain/ansanart.ts");
const { buildAlertText, alertPhones } = await import("../src/lib/brain/alerts.ts");
const listHtml = `<tr><td><a href="view.do?article_seq=605&amp;cpage=1"><span class="m_cat">[공고] </span>
  2027 안산 예술인 창작지원 공모 &amp; 모집</a><ul><li><b>작성일</b>2026-11-12</li></ul></td></tr>
  <tr><td><a href="view.do?article_seq=604&amp;cpage=1"><span class="m_cat">[공고] </span>안산리서치 공모 최종 선정결과 발표</a><ul><li><b>작성일</b>2026-11-11</li></ul></td></tr>`;
const parsed = parseAnsanArtList(listHtml);
assert.deepEqual(parsed.map((p) => p.seq), ["605", "604"]);
assert.equal(parsed[0].title, "2027 안산 예술인 창작지원 공모 & 모집");
assert.equal(ansanArtToRow(parsed[1]), null); // 결과 발표는 제외
const aRow = ansanArtToRow(parsed[0], profile);
assert.equal(aRow.region, "안산");
assert.ok(aRow.url.endsWith("article_seq=605"));
const sms = buildAlertText(Array.from({ length: 7 }, (_, i) => ({ id: String(i), title: `공고${i}`, org: "안산문화재단", deadline: null, match_score: 80, url: "https://x" })));
assert.ok(sms.includes("새 공고 7건") && sms.includes("외 2건"));
process.env.BRAIN_ALERT_PHONES = "010-1234-5678, 02-123-4567,01098765432";
assert.deepEqual(alertPhones(), ["01012345678", "01098765432"]);
console.log("ansanart/alert OK");

if (process.env.LIVE) {
  const rows = await fetchAnsanArt(profile);
  console.log("ansanart live:", rows.length, "rows");
  for (const r of rows) console.log(" ", r.match_score, r.apply_start, r.category, r.title.slice(0, 50));
}

// ── 축제·공연 참가 공모 분류 (실제 과거 공고 제목) ──
const { ansanArtCategory } = await import("../src/lib/brain/ansanart.ts");
const { isStageParticipation } = await import("../src/lib/brain/notices.ts");
const cat = (t) => ansanArtCategory(t);
assert.equal(cat("제23회 안산거리극축제 국내공식참가작 공모"), "축제·공연 참가 공모");
assert.equal(cat("2026 안산거리예술마켓 ASAM 초이스 작품 공모"), "축제·공연 참가 공모");
assert.equal(cat("2026 오픈 더 보노마루 <스트릿댄스 페스타> 참여자 모집 공모(기간연장)"), "축제·공연 참가 공모");
assert.equal(cat("2026 꿈의 극단 '안산' 단원 모집"), "축제·공연 참가 공모");
assert.equal(cat("2027년도 안산문화예술의전당 공연장 1분기 수시대관 공고"), "공간 대관");
assert.equal(cat("제7회 안산 김홍도축제 행사 대행 용역 입찰 공고"), "행사 용역 입찰");
assert.equal(ansanArtToRow({ seq: "1", title: "제22회 안산국제거리극축제 홍보현수막 제작 소액수의계약 견적제출 안내공고", date: "2026-11-01" }), null);
assert.equal(ansanArtToRow({ seq: "2", title: "2025 안산거리예술마켓 행사 운영 대행 제안서 평가위원 후보자 모집", date: "2026-11-01" }), null);
// K-Startup 스타트업 행사는 참가 공모로 잡히면 안 됨
assert.equal(isStageParticipation("「2026년 대구스타트업 리더스포럼」제65차 IR피칭 참여기업 모집"), false);
assert.equal(isStageParticipation("VC밋업 : 4인의 심사역과 함께하는 테이블토크"), false);
assert.equal(isStageParticipation("2026 서울패션위크 시니어 모델 모집"), true);
// 참가 공모가 대관보다 점수가 높아야 함
const sc = (t) => ansanArtToRow({ seq: "9", title: t, date: "2026-11-01" }, profile).match_score;
assert.ok(sc("제23회 안산거리극축제 국내공식참가작 공모") > sc("2027년도 안산문화예술의전당 공연장 1분기 수시대관 공고"));
console.log("participation OK");
