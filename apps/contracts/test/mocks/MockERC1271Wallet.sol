// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract MockERC1271Wallet is IERC1271 {
    address public owner;

    constructor(address _owner) {
        owner = _owner;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view override returns (bytes4) {
        // Copy calldata signature to memory for ECDSA.recover
        bytes memory sig = signature;
        address recovered = ECDSA.recover(hash, sig);
        if (recovered == owner) {
            return IERC1271.isValidSignature.selector; // 0x1626ba7e
        }
        return 0xffffffff;
    }
}
