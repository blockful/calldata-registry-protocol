export type ProposalStatus = "draft" | "in_review" | "approved" | "rejected";

export type ReviewDecision = "approved" | "rejected";

export interface Executor {
  id: string;
  label: string;
  address: string;
}

export interface CalldataAction {
  id: string;
  target: string;
  value: string;
  calldata: string;
}

export interface ProposalVersion {
  id: string;
  label: string;
  parentIds: string[];
  author: string;
  createdAt: string;
  summary: string;
  x: number;
  y: number;
  actions: CalldataAction[];
}

export interface Review {
  id: string;
  versionId: string;
  actionId: string;
  reviewer: string;
  decision: ReviewDecision;
  comment: string;
  createdAt: string;
}

export interface Proposal {
  id: string;
  executorId: string;
  title: string;
  description: string;
  status: ProposalStatus;
  createdAt: string;
  versions: ProposalVersion[];
  reviews: Review[];
}

export const mockExecutors: Executor[] = [
  {
    id: "executor-a",
    label: "Executor A",
    address: "0x5b38Da6a701c568545dCfcB03FcB875f56beddC4",
  },
  {
    id: "executor-b",
    label: "Executor B",
    address: "0x4200000000000000000000000000000000000007",
  },
  {
    id: "executor-c",
    label: "Executor C",
    address: "0x9fC3da866e7DF3a1c57adE1a97c9f00a70f010c8",
  },
];

export const mockProposals: Proposal[] = [
  {
    id: "prop-001",
    executorId: "executor-a",
    title: "Parameter update",
    description:
      "Updates one parameter and publishes the exact calldata for review.",
    status: "in_review",
    createdAt: "Apr 28, 2026",
    versions: [
      {
        id: "prop-001-v1",
        label: "v1",
        parentIds: [],
        author: "0x8E3c...19D4",
        createdAt: "Apr 28, 2026",
        summary: "Initial calldata submitted by the proposer.",
        x: 22,
        y: 50,
        actions: [
          {
            id: "prop-001-v1-a1",
            target: "0x1111111254EEB25477B68fb85Ed929f73A960582",
            value: "0",
            calldata:
              "0x7f39b370000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000000000023",
          },
        ],
      },
      {
        id: "prop-001-v2",
        label: "v2",
        parentIds: ["prop-001-v1"],
        author: "0x8E3c...19D4",
        createdAt: "Apr 29, 2026",
        summary: "Updated calldata after review comments.",
        x: 58,
        y: 50,
        actions: [
          {
            id: "prop-001-v2-a1",
            target: "0x1111111254EEB25477B68fb85Ed929f73A960582",
            value: "0",
            calldata:
              "0x7f39b370000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000000000000000000000000000000000000000002a",
          },
        ],
      },
    ],
    reviews: [
      {
        id: "review-001",
        versionId: "prop-001-v1",
        actionId: "prop-001-v1-a1",
        reviewer: "0x5F91...bE21",
        decision: "rejected",
        comment: "The submitted calldata does not match the intended value.",
        createdAt: "Apr 28, 2026",
      },
      {
        id: "review-002",
        versionId: "prop-001-v2",
        actionId: "prop-001-v2-a1",
        reviewer: "0x5F91...bE21",
        decision: "approved",
        comment: "The updated calldata matches the reviewed value.",
        createdAt: "Apr 29, 2026",
      },
    ],
  },
  {
    id: "prop-002",
    executorId: "executor-b",
    title: "Signer rotation",
    description:
      "Publishes calldata for rotating one signer and updating the owner set.",
    status: "draft",
    createdAt: "Apr 29, 2026",
    versions: [
      {
        id: "prop-002-v1",
        label: "v1",
        parentIds: [],
        author: "0xAF83...7102",
        createdAt: "Apr 29, 2026",
        summary: "Initial signer rotation calldata.",
        x: 20,
        y: 50,
        actions: [
          {
            id: "prop-002-v1-a1",
            target: "0x4200000000000000000000000000000000000007",
            value: "0",
            calldata:
              "0xe318b52b0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000a11ce0000000000000000000000000000000000000000000000000000000000000000b0b",
          },
        ],
      },
      {
        id: "prop-002-v2",
        label: "v2",
        parentIds: ["prop-002-v1"],
        author: "0x21D0...F77b",
        createdAt: "Apr 30, 2026",
        summary: "Reviewer-created version with a second calldata action.",
        x: 52,
        y: 35,
        actions: [
          {
            id: "prop-002-v2-a1",
            target: "0x4200000000000000000000000000000000000007",
            value: "0",
            calldata:
              "0xe318b52b0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000a11ce0000000000000000000000000000000000000000000000000000000000000000b0b",
          },
          {
            id: "prop-002-v2-a2",
            target: "0x4200000000000000000000000000000000000007",
            value: "0",
            calldata:
              "0x694e80c30000000000000000000000000000000000000000000000000000000000000004",
          },
        ],
      },
      {
        id: "prop-002-v3",
        label: "fork",
        parentIds: ["prop-002-v1"],
        author: "0x68A4...c921",
        createdAt: "Apr 30, 2026",
        summary: "Alternative version under review.",
        x: 52,
        y: 68,
        actions: [
          {
            id: "prop-002-v3-a1",
            target: "0x4200000000000000000000000000000000000007",
            value: "0",
            calldata:
              "0x610b59250000000000000000000000003f5ce5fbfe3e9af3971d6d5c0d5c6dc6d6d4e2f9",
          },
        ],
      },
    ],
    reviews: [
      {
        id: "review-003",
        versionId: "prop-002-v1",
        actionId: "prop-002-v1-a1",
        reviewer: "0x68A4...c921",
        decision: "rejected",
        comment: "Needs the related update in the same proposal.",
        createdAt: "Apr 30, 2026",
      },
    ],
  },
  {
    id: "prop-003",
    executorId: "executor-c",
    title: "Token transfer",
    description:
      "Transfers tokens from the executor to a destination address.",
    status: "approved",
    createdAt: "Apr 27, 2026",
    versions: [
      {
        id: "prop-003-v1",
        label: "v1",
        parentIds: [],
        author: "0xD4E7...3301",
        createdAt: "Apr 27, 2026",
        summary: "Single transfer action.",
        x: 25,
        y: 50,
        actions: [
          {
            id: "prop-003-v1-a1",
            target: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
            value: "0",
            calldata:
              "0xa9059cbb0000000000000000000000002c8fbb630289363ac80705a1a61273f76fd5a1610000000000000000000000000000000000000000000011d2f3f61f6d82b00000",
          },
        ],
      },
    ],
    reviews: [
      {
        id: "review-004",
        versionId: "prop-003-v1",
        actionId: "prop-003-v1-a1",
        reviewer: "0x512B...7e19",
        decision: "approved",
        comment: "Target and calldata match the reviewed transfer.",
        createdAt: "Apr 27, 2026",
      },
    ],
  },
];
