import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export interface BuildInfo {
  version: string;
  branch: string;
  commit: string;
  commitFull: string;
  commitDate: string;
  commitSubject: string;
  buildTime: string;
}

export type GitExecutor = (command: string) => string;

export function readPackageVersion(packagePath = path.join(repoRoot, "package.json")) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  return pkg.version || "0.0.0";
}

function execGit(command: string): string {
  return execFileSync("git", ["-C", repoRoot, ...command.split(" ")], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function readGitValue(command: string, executor: GitExecutor): string {
  try {
    return executor(command);
  } catch {
    return "unknown";
  }
}

function readGitLatestTag(executor: GitExecutor): string {
  try {
    return executor("describe --tags --abbrev=0");
  } catch {
    return readPackageVersion();
  }
}

export function createBuildInfo({
  version,
  execGit: gitExecutor = execGit,
  now = () => new Date(),
}: { version?: string; execGit?: GitExecutor; now?: () => Date } = {}): BuildInfo {
  const resolvedVersion = version ?? readGitLatestTag(gitExecutor);
  return {
    version: resolvedVersion,
    branch: readGitValue("rev-parse --abbrev-ref HEAD", gitExecutor),
    commit: readGitValue("rev-parse --short=12 HEAD", gitExecutor),
    commitFull: readGitValue("rev-parse HEAD", gitExecutor),
    commitDate: readGitValue("log -1 --format=%cI", gitExecutor),
    commitSubject: readGitValue("log -1 --format=%s", gitExecutor),
    buildTime: now().toISOString(),
  };
}

export function createWebBuildInfoModule(buildInfo: BuildInfo): string {
  return `export const BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)};\n`;
}
