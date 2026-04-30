// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/CalldataRegistry.sol";
import "../src/CalldataReviewResolver.sol";
import {EAS} from "@eas/contracts/EAS.sol";
import {SchemaRegistry} from "@eas/contracts/SchemaRegistry.sol";
import {ISchemaRegistry} from "@eas/contracts/ISchemaRegistry.sol";
import {IEAS} from "@eas/contracts/IEAS.sol";

contract Deploy is Script {
    // Arachnid's deterministic deployer (present on most EVM chains)
    address constant DETERMINISTIC_CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    bytes32 constant SALT = bytes32(uint256(0x434452)); // "CDR"

    string constant REVIEW_SCHEMA = "uint256 draftId, bool approved, string comment";

    /// @notice Deploy via CREATE2 for deterministic multi-chain addresses
    function run() external returns (address deployed) {
        bytes memory creationCode = type(CalldataRegistry).creationCode;
        bytes memory payload = abi.encodePacked(SALT, creationCode);

        vm.startBroadcast();

        (bool success, bytes memory result) = DETERMINISTIC_CREATE2_DEPLOYER.call(payload);
        require(success && result.length == 20, "CREATE2 deployment failed");

        deployed = address(uint160(bytes20(result)));

        vm.stopBroadcast();

        console.log("CalldataRegistry deployed at:", deployed);
    }

    /// @notice Simple deployment using `new` (for local testing on Anvil).
    ///         Deploys CalldataRegistry + EAS + SchemaRegistry + CalldataReviewResolver + registers the review schema.
    function deploySimple() external {
        vm.startBroadcast();

        CalldataRegistry registry = new CalldataRegistry();
        console.log("CalldataRegistry deployed at:", address(registry));

        SchemaRegistry schemaRegistry = new SchemaRegistry();
        console.log("SchemaRegistry deployed at:", address(schemaRegistry));

        EAS eas = new EAS(schemaRegistry);
        console.log("EAS deployed at:", address(eas));

        CalldataReviewResolver resolver = new CalldataReviewResolver(
            IEAS(address(eas)),
            ICalldataRegistry(address(registry))
        );
        console.log("CalldataReviewResolver deployed at:", address(resolver));

        bytes32 schemaUID = schemaRegistry.register(REVIEW_SCHEMA, resolver, false);
        console.log("Review schema UID:");
        console.logBytes32(schemaUID);

        vm.stopBroadcast();
    }

    /// @notice Compute the expected CREATE2 deployment address
    function computeAddress() public pure returns (address) {
        bytes32 codeHash = keccak256(type(CalldataRegistry).creationCode);
        return address(uint160(uint256(keccak256(
            abi.encodePacked(bytes1(0xff), DETERMINISTIC_CREATE2_DEPLOYER, SALT, codeHash)
        ))));
    }
}
