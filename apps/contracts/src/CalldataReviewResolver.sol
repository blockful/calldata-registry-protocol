// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SchemaResolver} from "@eas/contracts/resolver/SchemaResolver.sol";
import {IEAS, Attestation} from "@eas/contracts/IEAS.sol";
import {ICalldataRegistry} from "./ICalldataRegistry.sol";

contract CalldataReviewResolver is SchemaResolver {
    ICalldataRegistry public immutable registry;

    event ReviewCreated(
        bytes32 indexed uid,
        uint256 indexed draftId,
        address indexed attester,
        bool approved,
        string comment
    );

    error DraftNotFound(uint256 draftId);

    constructor(IEAS eas, ICalldataRegistry _registry) SchemaResolver(eas) {
        registry = _registry;
    }

    function onAttest(Attestation calldata attestation, uint256 /*value*/) internal override returns (bool) {
        (uint256 draftId, bool approved, string memory comment) = abi.decode(attestation.data, (uint256, bool, string));
        if (!registry.draftExists(draftId)) revert DraftNotFound(draftId);
        emit ReviewCreated(attestation.uid, draftId, attestation.attester, approved, comment);
        return true;
    }

    function onRevoke(Attestation calldata /*attestation*/, uint256 /*value*/) internal pure override returns (bool) {
        return false;
    }
}
