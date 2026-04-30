import { http, createConfig } from "wagmi";
import { hardhat } from "wagmi/chains";

export const config = createConfig({
  chains: [hardhat],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
});

export const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ??
  "0x5FbDB2315678afecb367f032d93F642f64180aa3") as `0x${string}`;

export const PONDER_API_URL =
  process.env.NEXT_PUBLIC_PONDER_API_URL ?? "http://localhost:42069";

export const EAS_ADDRESS = (process.env.NEXT_PUBLIC_EAS_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const REVIEW_SCHEMA_UID = (process.env.NEXT_PUBLIC_REVIEW_SCHEMA_UID ??
  "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`;
