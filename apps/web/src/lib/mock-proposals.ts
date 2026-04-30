export type ReviewDecision = "approved" | "rejected";

export interface CalldataAction {
  id: string;
  target: string;
  value: string;
  calldata: string;
}

export interface DraftReview {
  id: string;
  draftId: string;
  reviewer: string;
  decision: ReviewDecision;
  comment: string;
  createdAt: string;
}

export interface Draft {
  id: string;
  executor: string;
  proposer: string;
  description: string;
  extraData: string;
  previousVersion: string | null;
  timestamp: string;
  actions: CalldataAction[];
  reviews: DraftReview[];
}

export const mockDrafts: Draft[] = [
  {
    id: "1",
    executor: "0x5b38Da6a701c568545dCfcB03FcB875f56beddC4",
    proposer: "0x8E3c1B4A0E04fC3D5f4d2f822a9aD48a2f0b19D4",
    description:
      "Updates one executor parameter and publishes the exact calldata for review.",
    extraData: "0x",
    previousVersion: null,
    timestamp: "Apr 28, 2026 14:12",
    actions: [
      {
        id: "draft-1-action-1",
        target: "0x1111111254EEB25477B68fb85Ed929f73A960582",
        value: "0",
        calldata:
          "0x7f39b370000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000000000023",
      },
    ],
    reviews: [
      {
        id: "review-1",
        draftId: "1",
        reviewer: "0x5F917cA8a4a2E6B1c0e55070F508A2a41713bE21",
        decision: "rejected",
        comment: "The submitted calldata does not match the intended value.",
        createdAt: "Apr 28, 2026 16:40",
      },
    ],
  },
  {
    id: "2",
    executor: "0x5b38Da6a701c568545dCfcB03FcB875f56beddC4",
    proposer: "0x8E3c1B4A0E04fC3D5f4d2f822a9aD48a2f0b19D4",
    description: "Updated calldata after review comments on draft #1.",
    extraData: "0x",
    previousVersion: "1",
    timestamp: "Apr 29, 2026 09:05",
    actions: [
      {
        id: "draft-2-action-1",
        target: "0x1111111254EEB25477B68fb85Ed929f73A960582",
        value: "0",
        calldata:
          "0x7f39b370000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000000000000000000000000000000000000000002a",
      },
    ],
    reviews: [
      {
        id: "review-2",
        draftId: "2",
        reviewer: "0x5F917cA8a4a2E6B1c0e55070F508A2a41713bE21",
        decision: "approved",
        comment: "The updated calldata matches the reviewed value.",
        createdAt: "Apr 29, 2026 10:11",
      },
    ],
  },
  {
    id: "6",
    executor: "0x5b38Da6a701c568545dCfcB03FcB875f56beddC4",
    proposer: "0x21D0fb5a14dBbAF938dE0a36902A6527d9d9F77b",
    description: "Fork of draft #1 using a smaller parameter value.",
    extraData: "0x",
    previousVersion: "1",
    timestamp: "Apr 29, 2026 11:30",
    actions: [
      {
        id: "draft-6-action-1",
        target: "0x1111111254EEB25477B68fb85Ed929f73A960582",
        value: "0",
        calldata:
          "0x7f39b370000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000000000018",
      },
    ],
    reviews: [],
  },
  {
    id: "7",
    executor: "0x5b38Da6a701c568545dCfcB03FcB875f56beddC4",
    proposer: "0x68A4dbC17595f5Af83E82C92B4927BB8e9Ffc921",
    description: "Fork of draft #1 that targets the replacement module.",
    extraData: "0x",
    previousVersion: "1",
    timestamp: "Apr 29, 2026 13:48",
    actions: [
      {
        id: "draft-7-action-1",
        target: "0x2222222254EEB25477B68fb85Ed929f73A960582",
        value: "0",
        calldata:
          "0x7f39b370000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000000000000000000000000000000000000000002a",
      },
    ],
    reviews: [
      {
        id: "review-5",
        draftId: "7",
        reviewer: "0x512B982C87425B57B8F1a99DA4C3B26C21517e19",
        decision: "rejected",
        comment: "Target differs from the reviewed executor module.",
        createdAt: "Apr 29, 2026 14:10",
      },
    ],
  },
  {
    id: "8",
    executor: "0x5b38Da6a701c568545dCfcB03FcB875f56beddC4",
    proposer: "0xD4E7c8E92532164F6Dfd4A1452694281Be293301",
    description: "Fork of draft #1 with one additional calldata action.",
    extraData: "0x",
    previousVersion: "1",
    timestamp: "Apr 29, 2026 15:22",
    actions: [
      {
        id: "draft-8-action-1",
        target: "0x1111111254EEB25477B68fb85Ed929f73A960582",
        value: "0",
        calldata:
          "0x7f39b370000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000000000000000000000000000000000000000002a",
      },
      {
        id: "draft-8-action-2",
        target: "0x1111111254EEB25477B68fb85Ed929f73A960582",
        value: "0",
        calldata:
          "0x694e80c30000000000000000000000000000000000000000000000000000000000000001",
      },
    ],
    reviews: [
      {
        id: "review-6",
        draftId: "8",
        reviewer: "0x5F917cA8a4a2E6B1c0e55070F508A2a41713bE21",
        decision: "approved",
        comment: "Both actions match the reviewed intent.",
        createdAt: "Apr 29, 2026 16:05",
      },
    ],
  },
  {
    id: "9",
    executor: "0x5b38Da6a701c568545dCfcB03FcB875f56beddC4",
    proposer: "0xB000000000000000000000000000000000000009",
    description: "Fork of draft #1 that keeps the original calldata for comparison.",
    extraData: "0x",
    previousVersion: "1",
    timestamp: "Apr 29, 2026 17:04",
    actions: [
      {
        id: "draft-9-action-1",
        target: "0x1111111254EEB25477B68fb85Ed929f73A960582",
        value: "0",
        calldata:
          "0x7f39b370000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000000000023",
      },
    ],
    reviews: [],
  },
  {
    id: "3",
    executor: "safe.treasury.eth",
    proposer: "0xAF83dF00132C4450AefAc07005A4C45453967102",
    description: "Initial signer rotation calldata.",
    extraData: "0x",
    previousVersion: null,
    timestamp: "Apr 29, 2026 18:30",
    actions: [
      {
        id: "draft-3-action-1",
        target: "0x4200000000000000000000000000000000000007",
        value: "0",
        calldata:
          "0xe318b52b0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000a11ce0000000000000000000000000000000000000000000000000000000000000000b0b",
      },
    ],
    reviews: [
      {
        id: "review-3",
        draftId: "3",
        reviewer: "0x68A4dbC17595f5Af83E82C92B4927BB8e9Ffc921",
        decision: "rejected",
        comment: "Needs the related update in the same draft.",
        createdAt: "Apr 30, 2026 08:24",
      },
    ],
  },
  {
    id: "4",
    executor: "safe.treasury.eth",
    proposer: "0x21D0fb5a14dBbAF938dE0a36902A6527d9d9F77b",
    description: "Fork of draft #3 with a second calldata action.",
    extraData: "0x",
    previousVersion: "3",
    timestamp: "Apr 30, 2026 10:15",
    actions: [
      {
        id: "draft-4-action-1",
        target: "0x4200000000000000000000000000000000000007",
        value: "0",
        calldata:
          "0xe318b52b0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000a11ce0000000000000000000000000000000000000000000000000000000000000000b0b",
      },
      {
        id: "draft-4-action-2",
        target: "0x4200000000000000000000000000000000000007",
        value: "0",
        calldata:
          "0x694e80c30000000000000000000000000000000000000000000000000000000000000004",
      },
    ],
    reviews: [],
  },
  {
    id: "5",
    executor: "0x9fC3da866e7DF3a1c57adE1a97c9f00a70f010c8",
    proposer: "0xD4E7c8E92532164F6Dfd4A1452694281Be293301",
    description: "Transfers tokens from the executor to a destination address.",
    extraData: "0x",
    previousVersion: null,
    timestamp: "Apr 27, 2026 11:52",
    actions: [
      {
        id: "draft-5-action-1",
        target: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
        value: "0",
        calldata:
          "0xa9059cbb0000000000000000000000002c8fbb630289363ac80705a1a61273f76fd5a1610000000000000000000000000000000000000000000011d2f3f61f6d82b00000",
      },
    ],
    reviews: [
      {
        id: "review-4",
        draftId: "5",
        reviewer: "0x512B982C87425B57B8F1a99DA4C3B26C21517e19",
        decision: "approved",
        comment: "Target and calldata match the reviewed transfer.",
        createdAt: "Apr 27, 2026 13:20",
      },
    ],
  },
];
