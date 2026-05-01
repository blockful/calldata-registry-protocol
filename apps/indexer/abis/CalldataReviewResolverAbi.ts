export const CalldataReviewResolverAbi = [
  {
    type: "event",
    name: "ReviewCreated",
    inputs: [
      { name: "uid", type: "bytes32", indexed: true },
      { name: "draftId", type: "uint256", indexed: true },
      { name: "attester", type: "address", indexed: true },
      { name: "approved", type: "bool", indexed: false },
      { name: "comment", type: "string", indexed: false },
    ],
  },
] as const;
