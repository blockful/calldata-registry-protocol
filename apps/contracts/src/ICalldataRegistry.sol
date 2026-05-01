// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICalldataRegistry {
    // ── Events ──────────────────────────────────────────────────────────

    event DraftPublished(
        uint256 indexed draftId,
        address indexed executor,
        address indexed proposer,
        address[] targets,
        uint256[] values,
        bytes[] calldatas,
        string description,
        bytes extraData,
        uint256 previousVersion
    );

    // ── Draft Publishing ────────────────────────────────────────────────

    function publishDraft(
        address executor,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        string calldata description,
        bytes calldata extraData,
        uint256 previousVersion
    ) external returns (uint256 draftId);

    function publishDraftBySig(
        address executor,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        string calldata description,
        bytes calldata extraData,
        uint256 previousVersion,
        address proposer,
        uint256 deadline,
        bytes calldata signature
    ) external returns (uint256 draftId);

    // ── Views ───────────────────────────────────────────────────────────

    function getDraft(uint256 draftId)
        external
        view
        returns (
            address executor,
            address proposer,
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas,
            string memory description,
            bytes memory extraData,
            uint256 previousVersion,
            uint256 timestamp
        );

    function draftExists(uint256 draftId) external view returns (bool);

    function nonces(address proposer) external view returns (uint256);
}
