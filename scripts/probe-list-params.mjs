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
const url =
  "https://apis.data.go.kr/1613000/AptListServiceV4/getSigunguAptListV4";

for (const params of [
  { bjdCode: "11680" },
  { lawdCd: "11680" },
  { sigunguCode: "11680" },
  { sidoCode: "11", sigunguCode: "680" },
  { loadCode: "11680" }
]) {
  const q = buildDataGoKrQueryString(
    new URLSearchParams({ ...params, pageNo: "1", numOfRows: "5", _type: "json" }),
    key
  );
  const r = await fetch(`${url}?${q}`);
  console.log(JSON.stringify(params), r.status, (await r.text()).slice(0, 80));
}
