import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = process.cwd();
const sourcePath = path.join(appRoot, "public/data/popular-ids.json");
const targetPath = path.join(appRoot, "mini/src/pages/popular/popular-ids.json");

export async function syncMiniPopularIds({
  source = sourcePath,
  target = targetPath,
  readFile = fsp.readFile,
  writeFile = fsp.writeFile,
  mkdir = fsp.mkdir,
} = {}) {
  const ids = JSON.parse(await readFile(source, "utf8"));

  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error(`${source} must contain an array of non-empty string ids`);
  }

  const content = `${JSON.stringify(ids, null, 2)}\n`;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");

  return { count: ids.length, target };
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  syncMiniPopularIds()
    .then(({ count, target }) => {
      console.log(`synced ${count} popular ids to ${path.relative(appRoot, target)}`);
    })
    .catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    });
}
