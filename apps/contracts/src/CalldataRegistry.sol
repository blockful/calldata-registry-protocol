// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {ICalldataRegistry} from "./ICalldataRegistry.sol";

contract CalldataRegistry is ICalldataRegistry, EIP712, Nonces {
    // ── EIP-712 Type Hash ───────────────────────────────────────────────

    bytes32 public constant DRAFT_PUBLISH_TYPEHASH = keccak256(
        "DraftPublish(address org,bytes32 actionsHash,bytes32 descriptionHash,bytes32 extraDataHash,uint256 previousVersion,address proposer,uint256 nonce,uint256 deadline)"
    );

    // ── Structs ─────────────────────────────────────────────────────────

    struct Org {
        string name;
        string metadataURI;
        bool registered;
    }

    struct Draft {
        address org;
        address proposer;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string description;
        bytes extraData;
        uint256 previousVersion;
        uint256 timestamp;
    }

    // ── Storage ─────────────────────────────────────────────────────────

    mapping(address => Org) private _orgs;
    mapping(uint256 => Draft) private _drafts;
    uint256 private _nextDraftId = 1;

    // ── Errors ──────────────────────────────────────────────────────────

    error OrgAlreadyRegistered(address orgId);
    error OrgNotRegistered(address orgId);
    error ArrayLengthMismatch();
    error InvalidPreviousVersion(uint256 previousVersion);
    error DeadlineExpired(uint256 deadline);
    error InvalidSignature();

    // ── Constructor ─────────────────────────────────────────────────────

    constructor() EIP712("CalldataRegistry", "1") {}

    // ── Org Management ──────────────────────────────────────────────────

    function registerOrg(string calldata name, string calldata metadataURI) external {
        if (_orgs[msg.sender].registered) {
            revert OrgAlreadyRegistered(msg.sender);
        }

        _orgs[msg.sender] = Org({name: name, metadataURI: metadataURI, registered: true});

        emit OrgRegistered(msg.sender, name, metadataURI);
    }

    function updateOrg(string calldata name, string calldata metadataURI) external {
        if (!_orgs[msg.sender].registered) {
            revert OrgNotRegistered(msg.sender);
        }

        _orgs[msg.sender].name = name;
        _orgs[msg.sender].metadataURI = metadataURI;

        emit OrgUpdated(msg.sender, name, metadataURI);
    }

    // ── Draft Publishing ────────────────────────────────────────────────

    function publishDraft(
        address org,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        string calldata description,
        bytes calldata extraData,
        uint256 previousVersion
    ) external returns (uint256 draftId) {
        draftId = _publishDraft(org, targets, values, calldatas, description, extraData, previousVersion, msg.sender);
    }

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
    ) external returns (uint256 draftId) {
        if (block.timestamp > deadline) {
            revert DeadlineExpired(deadline);
        }

        bytes32 actionsHash = keccak256(abi.encode(targets, values, calldatas));
        bytes32 descriptionHash = keccak256(bytes(description));
        bytes32 extraDataHash = keccak256(extraData);

        bytes32 structHash = keccak256(
            abi.encode(
                DRAFT_PUBLISH_TYPEHASH,
                org,
                actionsHash,
                descriptionHash,
                extraDataHash,
                previousVersion,
                proposer,
                _useNonce(proposer),
                deadline
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);

        if (!SignatureChecker.isValidSignatureNow(proposer, digest, signature)) {
            revert InvalidSignature();
        }

        draftId = _publishDraft(org, targets, values, calldatas, description, extraData, previousVersion, proposer);
    }

    // ── Views ───────────────────────────────────────────────────────────

    function getOrg(address orgId)
        external
        view
        returns (string memory name, string memory metadataURI, bool registered)
    {
        Org storage o = _orgs[orgId];
        return (o.name, o.metadataURI, o.registered);
    }

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
        )
    {
        Draft storage d = _drafts[draftId];
        return (
            d.org,
            d.proposer,
            d.targets,
            d.values,
            d.calldatas,
            d.description,
            d.extraData,
            d.previousVersion,
            d.timestamp
        );
    }

    function draftExists(uint256 draftId) external view returns (bool) {
        return _drafts[draftId].timestamp != 0;
    }

    // ── Nonces Override ────────────────────────────────────────────────

    function nonces(address owner) public view override(ICalldataRegistry, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    // ── Internal ────────────────────────────────────────────────────────

    function _publishDraft(
        address org,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        string calldata description,
        bytes calldata extraData,
        uint256 previousVersion,
        address proposer
    ) internal returns (uint256 draftId) {
        if (targets.length != values.length || targets.length != calldatas.length) {
            revert ArrayLengthMismatch();
        }

        if (previousVersion != 0 && _drafts[previousVersion].timestamp == 0) {
            revert InvalidPreviousVersion(previousVersion);
        }

        draftId = _nextDraftId++;

        Draft storage d = _drafts[draftId];
        d.org = org;
        d.proposer = proposer;
        d.targets = targets;
        d.values = values;
        d.calldatas = calldatas;
        d.description = description;
        d.extraData = extraData;
        d.previousVersion = previousVersion;
        d.timestamp = block.timestamp;

        emit DraftPublished(draftId, org, proposer, previousVersion);
    }
}
