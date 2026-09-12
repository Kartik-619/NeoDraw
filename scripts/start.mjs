import { spawn } from "node:child_process";

const PORT = process.env.PORT || "3000";
const children = [];

function spawnService(name, args, overrides = {}) {
  const env = { ...process.env, ...overrides };
  delete env.PORT;

  const child = spawn("pnpm", args, {
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("exit", (code) => {
    console.error(`[${name}] exited with code ${code ?? "null"}`);
    for (const sibling of children) {
      if (sibling !== child && sibling.exitCode === null) sibling.kill();
    }
    process.exit(code ?? 1);
  });

  child.on("error", (err) => {
    console.error(`[${name}] failed to start: ${err.message}`);
    process.exit(1);
  });

  return child;
}

children.push(spawnService("http-backend", ["--filter", "@repo/http-backend", "start"]));
children.push(spawnService("frontend", ["--filter", "@repo/neodraw-frontend", "start"], { PORT }));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    for (const child of children) child.kill();
  });
}