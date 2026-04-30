import { spawn, ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const CONTRACTS_DIR = path.join(ROOT, "apps/contracts");
const INDEXER_DIR = path.join(ROOT, "apps/indexer");

// ── Port Utilities ─────────────────────────────────────────────────────────

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

export interface DeployResult {
  registryAddress: `0x${string}`;
  easAddress: `0x${string}`;
  schemaRegistryAddress: `0x${string}`;
  resolverAddress: `0x${string}`;
  schemaUID: `0x${string}`;
}

export async function deployContracts(rpcUrl: string): Promise<DeployResult> {
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

      // Parse addresses from broadcast JSON
      const broadcastPaths = [
        path.join(CONTRACTS_DIR, "broadcast/Deploy.s.sol/31337/deploySimple-latest.json"),
        path.join(CONTRACTS_DIR, "broadcast/Deploy.s.sol/31337/run-latest.json"),
      ];

      for (const broadcastPath of broadcastPaths) {
        try {
          const raw = await readFile(broadcastPath, "utf-8");
          const data = JSON.parse(raw);
          const creates = data.transactions.filter(
            (tx: any) => tx.transactionType === "CREATE"
          );

          if (creates.length >= 4) {
            resolve({
              registryAddress: creates[0].contractAddress as `0x${string}`,
              schemaRegistryAddress: creates[1].contractAddress as `0x${string}`,
              easAddress: creates[2].contractAddress as `0x${string}`,
              resolverAddress: creates[3].contractAddress as `0x${string}`,
              schemaUID: parseSchemaUID(stdout + stderr),
            });
            return;
          }
        } catch {
          // Try next path
        }
      }

      // Fallback: parse from stdout
      const addresses = [...(stdout + stderr).matchAll(/deployed.*?at:\s*(0x[0-9a-fA-F]{40})/gi)]
        .map(m => m[1] as `0x${string}`);

      if (addresses.length >= 4) {
        resolve({
          registryAddress: addresses[0],
          schemaRegistryAddress: addresses[1],
          easAddress: addresses[2],
          resolverAddress: addresses[3],
          schemaUID: parseSchemaUID(stdout + stderr),
        });
        return;
      }

      // Legacy fallback for single contract
      const match = (stdout + stderr).match(/Contract Address:\s*(0x[0-9a-fA-F]{40})/i);
      if (match) {
        resolve({
          registryAddress: match[1] as `0x${string}`,
          easAddress: "0x0000000000000000000000000000000000000000",
          schemaRegistryAddress: "0x0000000000000000000000000000000000000000",
          resolverAddress: "0x0000000000000000000000000000000000000000",
          schemaUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
        });
        return;
      }

      reject(
        new Error(
          `Could not parse contract addresses from deploy output:\n${stdout}\n${stderr}`
        )
      );
    });

    proc.on("error", reject);
  });
}

function parseSchemaUID(output: string): `0x${string}` {
  const match = output.match(/0x[0-9a-fA-F]{64}/);
  return (match ? match[0] : "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`;
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
  port?: number,
  easAddress?: string
): Promise<PonderInstance> {
  if (port === undefined) {
    port = await getFreePort();
  }

  const ponderPort = port;

  return new Promise((resolve, reject) => {
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      PONDER_RPC_URL_31337: rpcUrl,
      REGISTRY_ADDRESS: contractAddress,
    };

    if (easAddress) {
      env.EAS_ADDRESS = easAddress;
    }

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
      if (
        !started &&
        (text.includes("Created HTTP server") ||
          text.includes("Live at") ||
          text.includes("Started returning 200"))
      ) {
        started = true;
        clearTimeout(timer);
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
