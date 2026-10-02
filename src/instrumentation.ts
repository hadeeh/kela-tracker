/**
 * Runs once when Next.js starts. Spawns the vote-service as a child process
 * so it inherits the Next.js dev server's parent (init/tini), keeping it
 * alive across bash tool invocations.
 */
import { spawn, type ChildProcess } from "child_process";
import { createWriteStream, existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const LOCK_FILE = "/home/z/my-project/.vote-service.lock";
const LOG_FILE = "/home/z/my-project/vote-service.log";
const VOTE_SERVICE_DIR = "/home/z/my-project/mini-services/vote-service";

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLock(): number | null {
  try {
    if (!existsSync(LOCK_FILE)) return null;
    const pid = parseInt(readFileSync(LOCK_FILE, "utf8").trim(), 10);
    if (Number.isNaN(pid)) return null;
    return pid;
  } catch {
    return null;
  }
}

function writeLock(pid: number) {
  try {
    writeFileSync(LOCK_FILE, String(pid));
  } catch {}
}

function clearLock() {
  try {
    if (existsSync(LOCK_FILE)) writeFileSync(LOCK_FILE, "");
  } catch {}
}

let monitor: NodeJS.Timeout | null = null;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV === "production") return;

  // Check existing lock
  const existingPid = readLock();
  if (existingPid && isProcessAlive(existingPid)) {
    // Already running, don't spawn again
    return;
  }

  spawnVoteService();
}

function spawnVoteService() {
  const logStream = createWriteStream(LOG_FILE, { flags: "a" });
  logStream.write(`\n[${new Date().toISOString()}] [instrumentation] spawning vote-service...\n`);

  const child: ChildProcess = spawn("bun", ["index.ts"], {
    cwd: VOTE_SERVICE_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: {
      ...process.env,
      NEXTAUTH_BASE: process.env.NEXTAUTH_URL || "http://localhost:3000",
    },
  });

  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);

  if (child.pid) {
    writeLock(child.pid);
    logStream.write(`[${new Date().toISOString()}] [instrumentation] vote-service pid=${child.pid}\n`);
  }

  child.on("exit", (code, signal) => {
    logStream.write(`[${new Date().toISOString()}] [instrumentation] vote-service exited code=${code} signal=${signal}\n`);
    clearLock();
    // Respawn after 3s
    setTimeout(() => {
      const stillAlive = readLock();
      if (!stillAlive || !isProcessAlive(stillAlive)) {
        spawnVoteService();
      }
    }, 3000);
  });

  // Detach so this child survives even if the Next.js process exits
  child.unref();

  // Safety: periodically verify the process is alive; if not, respawn
  if (!monitor) {
    monitor = setInterval(() => {
      const pid = readLock();
      if (!pid || !isProcessAlive(pid)) {
        const stillAlive = readLock();
        if (!stillAlive || !isProcessAlive(stillAlive)) {
          spawnVoteService();
        }
      }
    }, 10_000);
  }
}
