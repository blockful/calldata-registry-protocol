// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICalldataRegistry {
    // ── Events ──────────────────────────────────────────────────────────

    event OrgRegistered(address indexed orgId, string name, string metadataURI);
    event OrgUpdated(address indexed orgId, string name, string metadataURI);
    event DraftPublished(
        uint256 indexed draftId,
        address indexed org,
        address indexed proposer,
        uint256 previousVersion
    );

    // ── Org Management ──────────────────────────────────────────────────

    function registerOrg(string calldata name, string calldata metadataURI) external;
    function updateOrg(string calldata name, string calldata metadataURI) external;

    // ── Draft Publishing ────────────────────────────────────────────────

    function publishDraft(
        address org,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        string calldata description,
        bytes calldata extraData,
        uint256 previousVersion
    ) external returns (uint256 draftId);

    function publishDraftBySig(
        address org,
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

    function getOrg(address orgId)
        external
        view
        returns (string memory name, string memory metadataURI, bool registered);

    function getDraft(uint256 draftId)
        external
        view
        returns (
            address org,
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
