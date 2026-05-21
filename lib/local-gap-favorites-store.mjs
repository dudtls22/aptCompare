import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const DATA_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".data",
  "gap-favorites"
);

function clientFilePath(clientId) {
  const safe = String(clientId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safe) {
    throw new Error("clientId 가 필요합니다.");
  }
  return path.join(DATA_DIR, `${safe}.json`);
}

export async function readLocalGapFavorites(clientId) {
  try {
    const raw = await fs.readFile(clientFilePath(clientId), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err && typeof err === "object" && err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

export async function writeLocalGapFavorites(clientId, list) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(clientFilePath(clientId), JSON.stringify(list), "utf8");
}
