import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createMiniBuildInfo } from "./mini-build-info.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const miniPackagePath = resolve(repoRoot, "mini/package.json");
const outputPath = resolve(repoRoot, "mini/src/buildInfo.ts");
const miniPackage = JSON.parse(readFileSync(miniPackagePath, "utf8"));
const buildInfo = createMiniBuildInfo({ version: miniPackage.version });

const content = `export const BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)} as const;

export type BuildInfo = typeof BUILD_INFO;
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, content);

console.log(`Wrote ${outputPath}`);
