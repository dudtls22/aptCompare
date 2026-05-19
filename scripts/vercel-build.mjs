import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "index.html");
const destDir = path.join(root, "public");
const dest = path.join(destDir, "index.html");

if (!fs.existsSync(src)) {
  console.error("[vercel-build] index.html not found at", src);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("[vercel-build] copied index.html -> public/index.html");
