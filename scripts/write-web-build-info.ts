import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createBuildInfo, createWebBuildInfoModule } from "./build-info";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(repoRoot, "src/buildInfo.generated.ts");
const buildInfo = createBuildInfo();
const content = createWebBuildInfoModule(buildInfo);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, content);

console.log(`Wrote ${outputPath}`);
