export type ProposalStatus =
  | "ready"
  | "in-review"
  | "needs-changes"
  | "executed";

export type RiskLevel = "low" | "medium" | "high";

export interface ProposalVersion {
  id: string;
  label: string;
  parentIds: string[];
  title: string;
  author: string;
  timestamp: string;
  status: ProposalStatus;
  risk: RiskLevel;
  x: number;
  y: number;
  summary: string;
  changes: string[];
}

export interface DecodedArg {
  name: string;
  type: string;
  value: string;
}

export interface CalldataAction {
  id: string;
  label: string;
  targetName: string;
  target: string;
  value: string;
  signature: string;
  selector: string;
  calldata: string;
  risk: RiskLevel;
  simulation: string;
  decodedArgs: DecodedArg[];
}

export interface ReviewCheck {
  label: string;
  state: "pass" | "warn" | "fail";
  detail: string;
}

export interface ReviewEvent {
  actor: string;
  action: string;
  timestamp: string;
}

export interface Proposal {
  id: string;
  title: string;
  org: string;
  chain: string;
  proposer: string;
  status: ProposalStatus;
  risk: RiskLevel;
  updatedAt: string;
  reviewScore: number;
  approvals: number;
  requiredApprovals: number;
  activeVersionId: string;
  description: string;
  versions: ProposalVersion[];
  actions: CalldataAction[];
  checks: ReviewCheck[];
  events: ReviewEvent[];
}

export const mockProposals: Proposal[] = [
  {
    id: "cdr-1027",
    title: "Treasury Diversification Batch",
    org: "Protocol DAO",
    chain: "Ethereum",
    proposer: "0x8E3c...19D4",
    status: "ready",
    risk: "medium",
    updatedAt: "12 min ago",
    reviewScore: 92,
    approvals: 5,
    requiredApprovals: 6,
    activeVersionId: "1027-v4",
    description:
      "Rebalances idle ETH into a three-leg stable allocation, updates the treasury policy cap, and queues the Safe batch for execution.",
    versions: [
      {
        id: "1027-v1",
        label: "v1",
        parentIds: [],
        title: "Initial treasury swap",
        author: "0x8E3c...19D4",
        timestamp: "Apr 27, 09:14",
        status: "needs-changes",
        risk: "high",
        x: 20,
        y: 47,
        summary: "Single route through Curve with no slippage guard.",
        changes: ["Published initial calldata", "One swap target", "No policy update"],
      },
      {
        id: "1027-v2",
        label: "v2",
        parentIds: ["1027-v1"],
        title: "Add slippage guard",
        author: "0x5F91...bE21",
        timestamp: "Apr 28, 11:32",
        status: "in-review",
        risk: "medium",
        x: 42,
        y: 25,
        summary: "Adds minimum output checks and splits execution across two pools.",
        changes: ["Adds minOut", "Splits swap route", "Keeps treasury cap unchanged"],
      },
      {
        id: "1027-v3",
        label: "fork",
        parentIds: ["1027-v1"],
        title: "Conservative fork",
        author: "0x3BC2...640a",
        timestamp: "Apr 28, 17:06",
        status: "in-review",
        risk: "low",
        x: 42,
        y: 69,
        summary: "Reduces size by 40% and leaves policy unchanged.",
        changes: ["Smaller rebalance", "No policy change", "Lower execution value"],
      },
      {
        id: "1027-v4",
        label: "v4",
        parentIds: ["1027-v2", "1027-v3"],
        title: "Merged reviewer fixes",
        author: "0x8E3c...19D4",
        timestamp: "Apr 29, 14:42",
        status: "ready",
        risk: "medium",
        x: 68,
        y: 47,
        summary: "Merges slippage protection with the lower-risk sizing fork.",
        changes: ["Merges two review branches", "Adds policy cap", "Ready for execution"],
      },
      {
        id: "1027-v5",
        label: "alt",
        parentIds: ["1027-v2"],
        title: "Alternative DEX route",
        author: "0x71c8...f90C",
        timestamp: "Apr 29, 16:08",
        status: "needs-changes",
        risk: "high",
        x: 80,
        y: 21,
        summary: "Routes through an adapter that is not in the approved target list.",
        changes: ["Uses unapproved adapter", "Higher expected output", "Reviewer flag open"],
      },
    ],
    actions: [
      {
        id: "swap-01",
        label: "Swap idle ETH",
        targetName: "TreasuryExecutor",
        target: "0x5b38Da6a701c568545dCfcB03FcB875f56beddC4",
        value: "0 ETH",
        signature: "execute(address,uint256,bytes)",
        selector: "0xb61d27f6",
        risk: "medium",
        simulation: "Matches fork simulation, expected USDC delta +1,248,330.42",
        calldata:
          "0xb61d27f6000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000120",
        decodedArgs: [
          { name: "target", type: "address", value: "0xA0b8...eB48" },
          { name: "value", type: "uint256", value: "0" },
          { name: "data", type: "bytes", value: "transferFrom treasury route" },
        ],
      },
      {
        id: "policy-02",
        label: "Set stable cap",
        targetName: "TreasuryPolicy",
        target: "0x1111111254EEB25477B68fb85Ed929f73A960582",
        value: "0 ETH",
        signature: "setAssetCap(address,uint256)",
        selector: "0x7f39b370",
        risk: "low",
        simulation: "Policy cap moves from 35% to 42%",
        calldata:
          "0x7f39b370000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000000000000000000000000000000000000000002a",
        decodedArgs: [
          { name: "asset", type: "address", value: "0xA0b8...eB48" },
          { name: "capPercent", type: "uint256", value: "42" },
        ],
      },
      {
        id: "queue-03",
        label: "Queue Safe batch",
        targetName: "SafeModule",
        target: "0x9fC3da866e7DF3a1c57adE1a97c9f00a70f010c8",
        value: "0 ETH",
        signature: "queue(bytes32,uint48)",
        selector: "0x9d590db1",
        risk: "medium",
        simulation: "Execution window starts 48 hours after approval",
        calldata:
          "0x9d590db1d93498271a88d9fb6cc51ad44d55c34edce3c3a3b9fce8b81efb2a7100000000000000000000000000000000000000000000000000000000000002a30",
        decodedArgs: [
          { name: "batchHash", type: "bytes32", value: "0xd934...2a71" },
          { name: "delay", type: "uint48", value: "10800" },
        ],
      },
    ],
    checks: [
      {
        label: "Target allowlist",
        state: "pass",
        detail: "All three targets are registered execution contracts.",
      },
      {
        label: "Fork simulation",
        state: "pass",
        detail: "State changes match the reviewer snapshot.",
      },
      {
        label: "Reviewer quorum",
        state: "warn",
        detail: "One additional approval required before execution.",
      },
    ],
    events: [
      { actor: "0x5F91...bE21", action: "approved v4", timestamp: "8 min ago" },
      { actor: "0x3BC2...640a", action: "resolved fork comments", timestamp: "21 min ago" },
      { actor: "Simulation", action: "refreshed mainnet fork", timestamp: "38 min ago" },
    ],
  },
  {
    id: "cdr-1019",
    title: "Guardian Module Upgrade",
    org: "Security Council",
    chain: "Base",
    proposer: "0xAF83...7102",
    status: "in-review",
    risk: "high",
    updatedAt: "46 min ago",
    reviewScore: 68,
    approvals: 2,
    requiredApprovals: 5,
    activeVersionId: "1019-v3",
    description:
      "Rotates guardian ownership, installs the new pause module, and removes a deprecated signer from the emergency Safe.",
    versions: [
      {
        id: "1019-v1",
        label: "v1",
        parentIds: [],
        title: "Install module",
        author: "0xAF83...7102",
        timestamp: "Apr 26, 18:11",
        status: "needs-changes",
        risk: "high",
        x: 20,
        y: 53,
        summary: "Module install without signer rotation.",
        changes: ["Adds module", "No owner rotation"],
      },
      {
        id: "1019-v2",
        label: "v2",
        parentIds: ["1019-v1"],
        title: "Rotate signers",
        author: "0xAF83...7102",
        timestamp: "Apr 27, 12:04",
        status: "in-review",
        risk: "medium",
        x: 44,
        y: 34,
        summary: "Adds owner swap but keeps threshold unchanged.",
        changes: ["Removes deprecated signer", "Adds new guardian"],
      },
      {
        id: "1019-v3",
        label: "v3",
        parentIds: ["1019-v2"],
        title: "Threshold fix",
        author: "0x21D0...F77b",
        timestamp: "Apr 29, 10:25",
        status: "in-review",
        risk: "high",
        x: 72,
        y: 53,
        summary: "Updates threshold after signer rotation and re-runs simulation.",
        changes: ["Updates threshold", "Adds rollback note", "Open high-risk review"],
      },
    ],
    actions: [
      {
        id: "guardian-01",
        label: "Enable pause module",
        targetName: "EmergencySafe",
        target: "0x4200000000000000000000000000000000000007",
        value: "0 ETH",
        signature: "enableModule(address)",
        selector: "0x610b5925",
        risk: "high",
        simulation: "Module enabled, owner set changes require one more confirmation",
        calldata:
          "0x610b59250000000000000000000000003f5ce5fbfe3e9af3971d6d5c0d5c6dc6d6d4e2f9",
        decodedArgs: [
          { name: "module", type: "address", value: "0x3f5C...e2F9" },
        ],
      },
      {
        id: "guardian-02",
        label: "Swap owner",
        targetName: "EmergencySafe",
        target: "0x4200000000000000000000000000000000000007",
        value: "0 ETH",
        signature: "swapOwner(address,address,address)",
        selector: "0xe318b52b",
        risk: "high",
        simulation: "Threshold remains 4 of 7 after swap",
        calldata:
          "0xe318b52b0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000a11ce0000000000000000000000000000000000000000000000000000000000000000b0b",
        decodedArgs: [
          { name: "prevOwner", type: "address", value: "0x0000...0001" },
          { name: "oldOwner", type: "address", value: "0xA11c...0000" },
          { name: "newOwner", type: "address", value: "0x0000...0B0b" },
        ],
      },
    ],
    checks: [
      {
        label: "Owner threshold",
        state: "warn",
        detail: "Threshold is correct, but two reviewers requested a rollback path.",
      },
      {
        label: "Module bytecode",
        state: "pass",
        detail: "Bytecode hash matches audited commit.",
      },
      {
        label: "Execution window",
        state: "fail",
        detail: "Queued timestamp conflicts with council freeze window.",
      },
    ],
    events: [
      { actor: "0x21D0...F77b", action: "published threshold fix", timestamp: "46 min ago" },
      { actor: "0x68A4...c921", action: "requested freeze-window change", timestamp: "1h ago" },
      { actor: "Simulation", action: "flagged execution window", timestamp: "2h ago" },
    ],
  },
  {
    id: "cdr-1004",
    title: "L2 Fee Collector Sweep",
    org: "Ops Multisig",
    chain: "Optimism",
    proposer: "0xD4E7...3301",
    status: "executed",
    risk: "low",
    updatedAt: "2h ago",
    reviewScore: 100,
    approvals: 4,
    requiredApprovals: 4,
    activeVersionId: "1004-v2",
    description:
      "Sweeps accumulated fee collector balances to the canonical treasury and records the execution digest.",
    versions: [
      {
        id: "1004-v1",
        label: "v1",
        parentIds: [],
        title: "Initial sweep",
        author: "0xD4E7...3301",
        timestamp: "Apr 24, 13:48",
        status: "ready",
        risk: "low",
        x: 20,
        y: 50,
        summary: "Single transfer from collector to treasury.",
        changes: ["Publishes transfer calldata"],
      },
      {
        id: "1004-v2",
        label: "v2",
        parentIds: ["1004-v1"],
        title: "Execution digest",
        author: "0xD4E7...3301",
        timestamp: "Apr 29, 08:02",
        status: "executed",
        risk: "low",
        x: 66,
        y: 50,
        summary: "Adds executed transaction digest after matching calldata.",
        changes: ["Matches executed tx", "Stores final digest"],
      },
    ],
    actions: [
      {
        id: "sweep-01",
        label: "Transfer fees",
        targetName: "FeeCollector",
        target: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
        value: "0 ETH",
        signature: "transfer(address,uint256)",
        selector: "0xa9059cbb",
        risk: "low",
        simulation: "Collector balance reaches zero, treasury receives 84,220 OP",
        calldata:
          "0xa9059cbb0000000000000000000000002c8fbb630289363ac80705a1a61273f76fd5a1610000000000000000000000000000000000000000000011d2f3f61f6d82b00000",
        decodedArgs: [
          { name: "to", type: "address", value: "0x2c8F...a161" },
          { name: "amount", type: "uint256", value: "84220000000000000000000" },
        ],
      },
    ],
    checks: [
      {
        label: "Executed calldata",
        state: "pass",
        detail: "Submitted transaction input matches the reviewed draft.",
      },
      {
        label: "Balance delta",
        state: "pass",
        detail: "Treasury balance delta equals the decoded transfer amount.",
      },
      {
        label: "Reviewer quorum",
        state: "pass",
        detail: "All required reviewers approved before execution.",
      },
    ],
    events: [
      { actor: "Executor", action: "matched transaction 0xa8f1...9e33", timestamp: "2h ago" },
      { actor: "0xD4E7...3301", action: "published execution digest", timestamp: "2h ago" },
      { actor: "0x512B...7e19", action: "approved v2", timestamp: "3h ago" },
    ],
  },
];
