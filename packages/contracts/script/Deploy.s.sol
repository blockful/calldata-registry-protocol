// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/CalldataRegistry.sol";

contract Deploy is Script {
    // Arachnid's deterministic deployer (present on most EVM chains)
    address constant DETERMINISTIC_CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    bytes32 constant SALT = bytes32(uint256(0x434452)); // "CDR"

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

    /// @notice Simple deployment using `new` (for local testing on Anvil)
    function deploySimple() external returns (CalldataRegistry) {
        vm.startBroadcast();
        CalldataRegistry registry = new CalldataRegistry();
        vm.stopBroadcast();
        console.log("CalldataRegistry deployed (simple) at:", address(registry));
        return registry;
    }

    /// @notice Compute the expected CREATE2 deployment address
    function computeAddress() public pure returns (address) {
        bytes32 codeHash = keccak256(type(CalldataRegistry).creationCode);
        return address(uint160(uint256(keccak256(
            abi.encodePacked(bytes1(0xff), DETERMINISTIC_CREATE2_DEPLOYER, SALT, codeHash)
        ))));
    }
}
