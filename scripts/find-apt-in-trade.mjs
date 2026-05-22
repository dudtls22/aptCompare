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
const want = "래미안대치";

for (const ym of ["202501", "202502", "202503", "202504", "202505"]) {
  const q = buildDataGoKrQueryString(
    new URLSearchParams({
      LAWD_CD: "11680",
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
  const d = await r.json();
  const items = d?.response?.body?.items?.item;
  const arr = items ? (Array.isArray(items) ? items : [items]) : [];
  const hit = arr.filter((x) => String(x.aptNm || "").replaceAll(" ", "").includes(want));
  if (hit.length) {
    console.log(ym, "n=", hit.length, "sample keys:", Object.keys(hit[0]).join(", "));
    console.log(JSON.stringify(hit[0], null, 2));
    break;
  }
}
