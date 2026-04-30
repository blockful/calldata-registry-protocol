export const calldataRegistryAbi = [
  // ── Events ──────────────────────────────────────────────────────────
  {
    type: "event",
    name: "DraftPublished",
    inputs: [
      { name: "draftId", type: "uint256", indexed: true },
      { name: "executor", type: "address", indexed: true },
      { name: "proposer", type: "address", indexed: true },
      { name: "previousVersion", type: "uint256", indexed: false },
    ],
  },

  // ── Draft Publishing ────────────────────────────────────────────────
  {
    type: "function",
    name: "publishDraft",
    stateMutability: "nonpayable",
    inputs: [
      { name: "executor", type: "address" },
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "description", type: "string" },
      { name: "extraData", type: "bytes" },
      { name: "previousVersion", type: "uint256" },
    ],
    outputs: [{ name: "draftId", type: "uint256" }],
  },
  {
    type: "function",
    name: "publishDraftBySig",
    stateMutability: "nonpayable",
    inputs: [
      { name: "executor", type: "address" },
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "description", type: "string" },
      { name: "extraData", type: "bytes" },
      { name: "previousVersion", type: "uint256" },
      { name: "proposer", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "draftId", type: "uint256" }],
  },

  // ── Views ───────────────────────────────────────────────────────────
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
      { name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "proposer", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// EIP-712 domain for gasless signature publishing
export const EIP712_DOMAIN = {
  name: "CalldataRegistry",
  version: "1",
} as const;

export const DRAFT_PUBLISH_TYPES = {
  DraftPublish: [
    { name: "executor", type: "address" },
    { name: "actionsHash", type: "bytes32" },
    { name: "descriptionHash", type: "bytes32" },
    { name: "extraDataHash", type: "bytes32" },
    { name: "previousVersion", type: "uint256" },
    { name: "proposer", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;
