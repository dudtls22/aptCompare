/**
 * 실거래(상세) API로 시군구 내 aptSeq·단지명 목록을 출력합니다.
 * kaptCode 매핑은 import-kapt-csv.mjs 로 data/kapt-lookup.json 에 넣으세요.
 *
 * node scripts/build-kapt-lookup-from-trade.mjs 11680
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildDataGoKrQueryString } from "../lib/data-go-key.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq <= 0) continue;
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  process.env[t.slice(0, eq).trim()] = v;
}

const key = process.env.DATA_GO_KR_SERVICE_KEY;
const lawd = String(process.argv[2] || "11680").trim();

const seen = new Map();
const now = new Date();
for (let i = 0; i < 12; i++) {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const q = buildDataGoKrQueryString(
    new URLSearchParams({
      LAWD_CD: lawd,
      DEAL_YMD: ym,
      pageNo: "1",
      numOfRows: "1000",
      _type: "json"
    }),
    key
  );
  const r = await fetch(
    `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?${q}`
  );
  const j = await r.json();
  const items = j?.response?.body?.items?.item;
  const arr = items ? (Array.isArray(items) ? items : [items]) : [];
  for (const it of arr) {
    const apt = String(it.aptNm || "").trim();
    const seq = String(it.aptSeq || "").trim();
    const dong = String(it.umdNm || "").trim();
    if (!apt || !seq) continue;
    seen.set(seq, { apt, dong });
  }
}

console.log(`lawd ${lawd}: ${seen.size} unique aptSeq (최근 12개월 trade-dev)`);
for (const [seq, info] of [...seen.entries()].sort((a, b) => a[1].apt.localeCompare(b[1].apt, "ko"))) {
  console.log(`${seq}\t${info.dong}\t${info.apt}`);
}
