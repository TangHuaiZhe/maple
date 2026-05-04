import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "mini/package.json"), "utf8"));
  return pkg.version || "0.0.0";
}

function execGit(command) {
  return execFileSync("git", ["-C", repoRoot, ...command.split(" ")], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function readGitValue(command, executor) {
  try {
    return executor(command);
  } catch {
    return "unknown";
  }
}

export function createMiniBuildInfo({
  version = readPackageVersion(),
  execGit: gitExecutor = execGit,
  now = () => new Date(),
} = {}) {
  return {
    version,
    commit: readGitValue("rev-parse --short=12 HEAD", gitExecutor),
    commitFull: readGitValue("rev-parse HEAD", gitExecutor),
    commitDate: readGitValue("log -1 --format=%cI", gitExecutor),
    commitSubject: readGitValue("log -1 --format=%s", gitExecutor),
    buildTime: now().toISOString(),
  };
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  console.log(JSON.stringify(createMiniBuildInfo(), null, 2));
}
