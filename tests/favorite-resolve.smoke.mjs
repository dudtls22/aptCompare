/**
 * 즐겨찾기 동/아파트명 보정 로직 스모크 테스트 (index.html 내용과 동일 규칙)
 * 실행: node tests/favorite-resolve.smoke.mjs
 */
function normalizeDongName(name) {
  return String(name || "").replaceAll(" ", "").trim();
}

function resolvePickToDongOption(rawDong, fixedDongs) {
  const d = String(rawDong || "").trim();
  if (!d) return "";
  if (fixedDongs.includes(d)) return d;
  const key = normalizeDongName(d);
  const found = fixedDongs.find((x) => normalizeDongName(x) === key);
  return found || d;
}

function resolvePickToAptOption(rawApt, aptNames) {
  const a = String(rawApt || "").trim();
  if (!a) return "";
  const list = aptNames.map((x) => String(x));
  if (list.includes(a)) return a;
  const hit = list.find((x) => x.trim() === a || normalizeDongName(x) === normalizeDongName(a));
  return hit || a;
}

const fixed = ["역삼동", "개포동", "청담동"];
console.assert(resolvePickToDongOption("역삼동", fixed) === "역삼동");
console.assert(resolvePickToDongOption("역 삼 동", fixed) === "역삼동");
console.assert(resolvePickToDongOption("  개포동 ", fixed) === "개포동");

const apts = ["래미안페이지", "아크로텔"];
console.assert(resolvePickToAptOption("래미안페이지", apts) === "래미안페이지");
console.assert(resolvePickToAptOption("  래미안페이지 ", apts) === "래미안페이지");
console.assert(resolvePickToAptOption("없는단지", apts) === "없는단지");

console.log("favorite-resolve.smoke: OK");
