export const CalldataDraftAbi = [
  {
    type: "event",
    name: "OrgRegistered",
    inputs: [
      { name: "orgId", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "metadataURI", type: "string", indexed: false }
    ]
  },
  {
    type: "event",
    name: "OrgUpdated",
    inputs: [
      { name: "orgId", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "metadataURI", type: "string", indexed: false }
    ]
  },
  {
    type: "event",
    name: "DraftPublished",
    inputs: [
      { name: "draftId", type: "uint256", indexed: true },
      { name: "org", type: "address", indexed: true },
      { name: "proposer", type: "address", indexed: true },
      { name: "previousVersion", type: "uint256", indexed: false }
    ]
  },
  {
    type: "function",
    name: "getDraft",
    stateMutability: "view",
    inputs: [{ name: "draftId", type: "uint256" }],
    outputs: [
      { name: "org", type: "address" },
      { name: "proposer", type: "address" },
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "description", type: "string" },
      { name: "extraData", type: "bytes" },
      { name: "previousVersion", type: "uint256" },
      { name: "timestamp", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "getOrg",
    stateMutability: "view",
    inputs: [{ name: "orgId", type: "address" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "registered", type: "bool" }
    ]
  }
] as const;
