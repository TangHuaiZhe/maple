import path from "node:path";
import { fileURLToPath } from "node:url";

import { createBuildInfo, readPackageVersion, repoRoot } from "./build-info.mjs";

export function createMiniBuildInfo({
  version = readPackageVersion(path.join(repoRoot, "mini/package.json")),
  execGit,
  now = () => new Date(),
} = {}) {
  return createBuildInfo({ version, execGit, now });
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  console.log(JSON.stringify(createMiniBuildInfo(), null, 2));
}
