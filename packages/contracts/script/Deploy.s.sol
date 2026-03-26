// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/CalldataRegistry.sol";

contract Deploy is Script {
    function run() external returns (CalldataRegistry) {
        vm.startBroadcast();
        CalldataRegistry registry = new CalldataRegistry();
        vm.stopBroadcast();
        return registry;
    }
}
