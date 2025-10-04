#!/usr/bin/env bun
import { spawnSync } from "child_process";
import { renameSync, existsSync } from "fs";
import path from "path";

function run(command: string, args: string[], cwd: string) {
  console.log(`Running: ${command} ${args.join(" ")} in ${cwd}`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Step 1: build backend
const backendDir = path.resolve(__dirname, "..", "backend");
run("bun", ["build.mjs"], backendDir);

// Step 3: build Tauri app
const appDir = path.resolve(__dirname, "..", "app");
run("bun", ["run", "tauri", "build"], appDir);
