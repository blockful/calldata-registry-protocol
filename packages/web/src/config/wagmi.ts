import { http, createConfig } from "wagmi";
import { hardhat } from "wagmi/chains";

export const config = createConfig({
  chains: [hardhat],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
});

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x5FbDB2315678afecb367f032d93F642f64180aa3") as `0x${string}`;

export const PONDER_API_URL =
  process.env.NEXT_PUBLIC_PONDER_API_URL ?? "http://localhost:42069";
