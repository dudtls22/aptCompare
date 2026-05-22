import { readFileSync } from "fs";
import { getFavorites, setFavorites } from "../lib/favorites-store.mjs";
import { getGapFavorites, setGapFavorites } from "../lib/gap-favorites-store.mjs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
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

const fav1 = [
  {
    lawdCd: "11140",
    guName: "중구",
    dong: "명동",
    apt: "전역1번테스트",
    area: "",
    notify: false
  }
];
const fav2 = [
  {
    lawdCd: "11680",
    guName: "강남구",
    dong: "역삼동",
    apt: "전역Gap테스트",
    area: "84"
  }
];

await setFavorites(fav1);
const got1 = await getFavorites();
console.log("screen1", got1.storage, got1.favorites[0]?.apt);

await setGapFavorites(fav2);
const got2 = await getGapFavorites();
console.log("screen2", got2.storage, got2.favorites[0]?.apt);
