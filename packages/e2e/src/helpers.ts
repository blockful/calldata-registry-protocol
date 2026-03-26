import { spawn, ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const CONTRACTS_DIR = path.join(ROOT, "packages/contracts");
const INDEXER_DIR = path.join(ROOT, "packages/indexer");

// ── Port Utilities ─────────────────────────────────────────────────────────

/** Find a free port by binding to port 0 and releasing it. */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("Could not get free port")));
      }
    });
    srv.on("error", reject);
  });
}

// ── Anvil ──────────────────────────────────────────────────────────────────

export interface AnvilInstance {
  process: ChildProcess;
  rpcUrl: string;
  port: number;
}

export async function startAnvil(port?: number): Promise<AnvilInstance> {
  if (port === undefined) {
    port = await getFreePort();
  }

  const anvilPort = port;

  return new Promise((resolve, reject) => {
    const proc = spawn(
      "anvil",
      ["--port", String(anvilPort), "--block-time", "1"],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    const rpcUrl = `http://127.0.0.1:${anvilPort}`;
    let started = false;

    const timer = setTimeout(() => {
      if (!started) {
        proc.kill();
        reject(new Error("Anvil failed to start within 15 s"));
      }
    }, 15_000);

    proc.stdout!.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (!started && text.includes("Listening on")) {
        started = true;
        clearTimeout(timer);
        resolve({ process: proc, rpcUrl, port: anvilPort });
      }
    });

    proc.stderr!.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (!started && text.includes("Listening on")) {
        started = true;
        clearTimeout(timer);
        resolve({ process: proc, rpcUrl, port: anvilPort });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("exit", (code) => {
      if (!started) {
        clearTimeout(timer);
        reject(new Error(`Anvil exited with code ${code}`));
      }
    });
  });
}

// ── Deploy Contracts ───────────────────────────────────────────────────────

export async function deployContracts(rpcUrl: string): Promise<`0x${string}`> {
  const privateKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  return new Promise((resolve, reject) => {
    const proc = spawn(
      "forge",
      [
        "script",
        "script/Deploy.s.sol",
        "--sig",
        "deploySimple()",
        "--rpc-url",
        rpcUrl,
        "--broadcast",
        "--private-key",
        privateKey,
      ],
      {
        cwd: CONTRACTS_DIR,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";

    proc.stdout!.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr!.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("exit", async (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `forge script failed (code ${code}):\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`
          )
        );
        return;
      }

      // Try parsing from broadcast JSON first (most reliable)
      const broadcastPaths = [
        path.join(CONTRACTS_DIR, "broadcast/Deploy.s.sol/31337/deploySimple-latest.json"),
        path.join(CONTRACTS_DIR, "broadcast/Deploy.s.sol/31337/run-latest.json"),
      ];
      for (const broadcastPath of broadcastPaths) {
        try {
          const raw = await readFile(broadcastPath, "utf-8");
          const data = JSON.parse(raw);
          for (const tx of data.transactions) {
            if (tx.transactionType === "CREATE") {
              resolve(tx.contractAddress as `0x${string}`);
              return;
            }
          }
        } catch {
          // Try next path
        }
      }

      // Parse from stdout
      const match = stdout.match(
        /Contract Address:\s*(0x[0-9a-fA-F]{40})/i
      );
      if (match) {
        resolve(match[1] as `0x${string}`);
        return;
      }

      // Try another stdout pattern
      const match2 = stdout.match(
        /new CalldataRegistry@(0x[0-9a-fA-F]{40})/i
      );
      if (match2) {
        resolve(match2[1] as `0x${string}`);
        return;
      }

      // Try "deployed ... at:" pattern
      const match3 = stdout.match(
        /deployed.*at:\s*(0x[0-9a-fA-F]{40})/i
      );
      if (match3) {
        resolve(match3[1] as `0x${string}`);
        return;
      }

      reject(
        new Error(
          `Could not parse contract address from deploy output:\n${stdout}`
        )
      );
    });

    proc.on("error", reject);
  });
}

// ── Ponder Indexer ─────────────────────────────────────────────────────────

export interface PonderInstance {
  process: ChildProcess;
  apiUrl: string;
  port: number;
}

export async function startPonder(
  contractAddress: string,
  rpcUrl: string,
  port?: number
): Promise<PonderInstance> {
  if (port === undefined) {
    port = await getFreePort();
  }

  const ponderPort = port;

  return new Promise((resolve, reject) => {
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      PONDER_RPC_URL_31337: rpcUrl,
      CDR_REGISTRY_ADDRESS: contractAddress,
    };

    const proc = spawn(
      "pnpm",
      ["ponder", "dev", "--port", String(ponderPort), "--disable-ui"],
      {
        cwd: INDEXER_DIR,
        stdio: ["ignore", "pipe", "pipe"],
        env,
      }
    );

    const apiUrl = `http://127.0.0.1:${ponderPort}`;
    let started = false;

    const timer = setTimeout(() => {
      if (!started) {
        proc.kill();
        reject(new Error("Ponder failed to start within 60 s"));
      }
    }, 60_000);

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      // With --disable-ui, Ponder prints structured log lines.
      // "Created HTTP server" means the API is accepting connections.
      if (
        !started &&
        (text.includes("Created HTTP server") ||
          text.includes("Live at") ||
          text.includes("Started returning 200"))
      ) {
        started = true;
        clearTimeout(timer);
        // Give ponder a moment to fully initialize
        setTimeout(
          () => resolve({ process: proc, apiUrl, port: ponderPort }),
          2_000
        );
      }
    };

    proc.stdout!.on("data", onData);
    proc.stderr!.on("data", onData);

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("exit", (code) => {
      if (!started) {
        clearTimeout(timer);
        reject(new Error(`Ponder exited with code ${code}`));
      }
    });
  });
}

// ── Wait for Ready ─────────────────────────────────────────────────────────

export async function waitForReady(
  url: string,
  timeout = 30_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for ${url} to be ready`);
}

// ── Cleanup ────────────────────────────────────────────────────────────────

export function cleanup(...processes: (ChildProcess | undefined | null)[]) {
  for (const proc of processes) {
    if (proc && !proc.killed) {
      proc.kill("SIGTERM");
      // Force kill after 3s if SIGTERM doesn't work
      setTimeout(() => {
        try {
          if (!proc.killed) proc.kill("SIGKILL");
        } catch {
          // already dead
        }
      }, 3_000);
    }
  }
}
