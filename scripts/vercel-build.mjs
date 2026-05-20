import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) {
      copyRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(path.join(root, "index.html"), path.join(publicDir, "index.html"));
copyRecursive(path.join(root, "css"), path.join(publicDir, "css"));
console.log("[vercel-build] copied index.html and css/ -> public/");
