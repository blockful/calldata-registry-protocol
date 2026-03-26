import { createConfig } from "ponder";
import { http } from "viem";
import { CalldataRegistryAbi } from "./abis/CalldataRegistryAbi";

export default createConfig({
  chains: {
    anvil: {
      id: 31337,
      rpc: process.env.PONDER_RPC_URL_31337 ?? "http://127.0.0.1:8545",
      disableCache: true,
    },
  },
  contracts: {
    CalldataRegistry: {
      abi: CalldataRegistryAbi,
      chain: "anvil",
      address: (process.env.REGISTRY_ADDRESS ?? "0x5FbDB2315678afecb367f032d93F642f64180aa3") as `0x${string}`,
      startBlock: 0,
    },
  },
});
