import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(repoRoot, "dist");
const rawImagesRoot = path.join(repoRoot, "data-source/Resource/园艺/raw");

const imageDirectories = [
  "rhs-images",
  "mrmaple-images",
  "herter-images",
  "ncsu-images",
  "coniferkingdom-images",
  "jmac-images",
  "user-images",
];

async function main() {
  const distStat = await fs.stat(distRoot).catch(() => null);
  if (!distStat?.isDirectory()) {
    throw new Error("dist/ 不存在，请先运行 npm run build:firebase");
  }

  for (const directory of imageDirectories) {
    const source = path.join(rawImagesRoot, directory);
    const target = path.join(distRoot, directory);
    const sourceStat = await fs.stat(source).catch(() => null);

    if (!sourceStat?.isDirectory()) {
      console.log(`Skip missing image directory: ${directory}`);
      continue;
    }

    await fs.rm(target, { recursive: true, force: true });
    await fs.cp(source, target, {
      recursive: true,
      dereference: true,
      force: true,
    });
    console.log(`Copied ${directory} into dist/`);
  }

  console.log("Firebase Hosting publish directory is ready: dist/");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
