// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SchemaResolver} from "@eas/contracts/resolver/SchemaResolver.sol";
import {IEAS, Attestation} from "@eas/contracts/IEAS.sol";
import {ICalldataRegistry} from "./ICalldataRegistry.sol";

/// @title CalldataReviewResolver
/// @notice EAS schema resolver that validates attestations reference an existing CalldataRegistry draft.
/// @dev Schema: "uint256 draftId, bool approved, string comment"
contract CalldataReviewResolver is SchemaResolver {
    ICalldataRegistry public immutable registry;

    error DraftNotFound(uint256 draftId);

    constructor(IEAS eas, ICalldataRegistry _registry) SchemaResolver(eas) {
        registry = _registry;
    }

    function onAttest(Attestation calldata attestation, uint256 /*value*/) internal view override returns (bool) {
        (uint256 draftId,,) = abi.decode(attestation.data, (uint256, bool, string));
        if (!registry.draftExists(draftId)) revert DraftNotFound(draftId);
        return true;
    }

    function onRevoke(Attestation calldata /*attestation*/, uint256 /*value*/) internal pure override returns (bool) {
        return true;
    }
}
