// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {ICalldataRegistry} from "./ICalldataRegistry.sol";

contract CalldataRegistry is ICalldataRegistry, EIP712, Nonces {
    // ── EIP-712 Type Hash ───────────────────────────────────────────────

    bytes32 public constant DRAFT_PUBLISH_TYPEHASH = keccak256(
        "DraftPublish(address executor,bytes32 actionsHash,bytes32 descriptionHash,bytes32 extraDataHash,uint256 previousVersion,address proposer,uint256 nonce,uint256 deadline)"
    );

    // ── Structs ─────────────────────────────────────────────────────────

    struct Draft {
        address executor;
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

    mapping(uint256 => Draft) private _drafts;
    uint256 private _nextDraftId = 1;

    // ── Errors ──────────────────────────────────────────────────────────

    error ArrayLengthMismatch();
    error InvalidPreviousVersion(uint256 previousVersion);
    error DeadlineExpired(uint256 deadline);
    error InvalidSignature();

    // ── Constructor ─────────────────────────────────────────────────────

    constructor() EIP712("CalldataRegistry", "1") {}

    // ── Draft Publishing ────────────────────────────────────────────────

    function publishDraft(
        address executor,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        string calldata description,
        bytes calldata extraData,
        uint256 previousVersion
    ) external returns (uint256 draftId) {
        draftId = _publishDraft(executor, targets, values, calldatas, description, extraData, previousVersion, msg.sender);
    }

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
                executor,
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

        draftId = _publishDraft(executor, targets, values, calldatas, description, extraData, previousVersion, proposer);
    }

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
        )
    {
        Draft storage d = _drafts[draftId];
        return (
            d.executor,
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
        address executor,
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
        d.executor = executor;
        d.proposer = proposer;
        d.targets = targets;
        d.values = values;
        d.calldatas = calldatas;
        d.description = description;
        d.extraData = extraData;
        d.previousVersion = previousVersion;
        d.timestamp = block.timestamp;

        emit DraftPublished(draftId, executor, proposer, targets, values, calldatas, description, extraData, previousVersion);
    }
}
