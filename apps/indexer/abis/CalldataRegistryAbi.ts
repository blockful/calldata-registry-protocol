export const CalldataRegistryAbi = [
  {
    type: "event",
    name: "DraftPublished",
    inputs: [
      { name: "draftId", type: "uint256", indexed: true },
      { name: "executor", type: "address", indexed: true },
      { name: "proposer", type: "address", indexed: true },
      { name: "targets", type: "address[]", indexed: false },
      { name: "values", type: "uint256[]", indexed: false },
      { name: "calldatas", type: "bytes[]", indexed: false },
      { name: "description", type: "string", indexed: false },
      { name: "extraData", type: "bytes", indexed: false },
      { name: "previousVersion", type: "uint256", indexed: false },
    ]
  },
  {
    type: "function",
    name: "getDraft",
    stateMutability: "view",
    inputs: [{ name: "draftId", type: "uint256" }],
    outputs: [
      { name: "executor", type: "address" },
      { name: "proposer", type: "address" },
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "description", type: "string" },
      { name: "extraData", type: "bytes" },
      { name: "previousVersion", type: "uint256" },
      { name: "timestamp", type: "uint256" }
    ]
  }
] as const;
