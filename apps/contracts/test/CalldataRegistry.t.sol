// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {CalldataRegistry} from "../src/CalldataRegistry.sol";
import {ICalldataRegistry} from "../src/ICalldataRegistry.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {MockERC1271Wallet} from "./mocks/MockERC1271Wallet.sol";

contract CalldataRegistryTest is Test {
    CalldataRegistry public registry;

    address public executor;
    address public proposer;
    uint256 public proposerKey;
    address public relayer;

    // Reusable draft parameters
    address[] targets;
    uint256[] values;
    bytes[] calldatas;
    string description;
    bytes extraData;

    function setUp() public {
        registry = new CalldataRegistry();

        executor = makeAddr("executor");
        (proposer, proposerKey) = makeAddrAndKey("proposer");
        relayer = makeAddr("relayer");

        // Set up reusable draft parameters
        targets = new address[](2);
        targets[0] = address(0x1111);
        targets[1] = address(0x2222);

        values = new uint256[](2);
        values[0] = 1 ether;
        values[1] = 2 ether;

        calldatas = new bytes[](2);
        calldatas[0] = abi.encodeWithSignature("transfer(address,uint256)", address(0x3333), 100);
        calldatas[1] = abi.encodeWithSignature("approve(address,uint256)", address(0x4444), 200);

        description = "Test proposal description";
        extraData = hex"deadbeef";
    }

    // ═══════════════════════════════════════════════════════════════════
    // Publish Draft
    // ═══════════════════════════════════════════════════════════════════

    function testPublishDraft() public {
        vm.prank(proposer);
        vm.expectEmit(true, true, true, true, address(registry));
        emit ICalldataRegistry.DraftPublished(1, executor, proposer, 0);
        uint256 draftId = registry.publishDraft(executor, targets, values, calldatas, description, extraData, 0);

        assertEq(draftId, 1);

        (
            address dExecutor,
            address dProposer,
            address[] memory dTargets,
            uint256[] memory dValues,
            bytes[] memory dCalldatas,
            string memory dDescription,
            bytes memory dExtraData,
            uint256 dPreviousVersion,
            uint256 dTimestamp
        ) = registry.getDraft(draftId);

        assertEq(dExecutor, executor);
        assertEq(dProposer, proposer);
        assertEq(dTargets.length, 2);
        assertEq(dTargets[0], targets[0]);
        assertEq(dTargets[1], targets[1]);
        assertEq(dValues.length, 2);
        assertEq(dValues[0], values[0]);
        assertEq(dValues[1], values[1]);
        assertEq(dCalldatas.length, 2);
        assertEq(dCalldatas[0], calldatas[0]);
        assertEq(dCalldatas[1], calldatas[1]);
        assertEq(dDescription, description);
        assertEq(dExtraData, extraData);
        assertEq(dPreviousVersion, 0);
        assertGt(dTimestamp, 0);
    }

    function testPublishDraftWithPreviousVersion() public {
        // Publish first draft
        vm.prank(proposer);
        uint256 firstDraftId = registry.publishDraft(executor, targets, values, calldatas, description, extraData, 0);
        assertEq(firstDraftId, 1);

        // Publish second draft referencing the first
        vm.prank(proposer);
        vm.expectEmit(true, true, true, true, address(registry));
        emit ICalldataRegistry.DraftPublished(2, executor, proposer, firstDraftId);
        uint256 secondDraftId =
            registry.publishDraft(executor, targets, values, calldatas, "Updated description", extraData, firstDraftId);

        assertEq(secondDraftId, 2);

        (, , , , , , , uint256 prevVersion, ) = registry.getDraft(secondDraftId);
        assertEq(prevVersion, firstDraftId);
    }

    function testPublishDraftInvalidPreviousVersion() public {
        vm.prank(proposer);
        vm.expectRevert(abi.encodeWithSelector(CalldataRegistry.InvalidPreviousVersion.selector, 999));
        registry.publishDraft(executor, targets, values, calldatas, description, extraData, 999);
    }

    function testPublishDraftArrayLengthMismatch() public {
        uint256[] memory wrongValues = new uint256[](1);
        wrongValues[0] = 1 ether;

        vm.prank(proposer);
        vm.expectRevert(CalldataRegistry.ArrayLengthMismatch.selector);
        registry.publishDraft(executor, targets, wrongValues, calldatas, description, extraData, 0);
    }

    function testPublishDraftArrayLengthMismatchCalldatas() public {
        bytes[] memory wrongCalldatas = new bytes[](3);
        wrongCalldatas[0] = hex"aa";
        wrongCalldatas[1] = hex"bb";
        wrongCalldatas[2] = hex"cc";

        vm.prank(proposer);
        vm.expectRevert(CalldataRegistry.ArrayLengthMismatch.selector);
        registry.publishDraft(executor, targets, values, wrongCalldatas, description, extraData, 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Publish Draft By Signature
    // ═══════════════════════════════════════════════════════════════════

    function testPublishDraftBySig() public {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = registry.nonces(proposer);

        bytes memory sig = _signDraft(
            proposerKey,
            executor,
            targets,
            values,
            calldatas,
            description,
            extraData,
            0,
            proposer,
            nonce,
            deadline
        );

        vm.prank(relayer);
        vm.expectEmit(true, true, true, true, address(registry));
        emit ICalldataRegistry.DraftPublished(1, executor, proposer, 0);
        uint256 draftId =
            registry.publishDraftBySig(executor, targets, values, calldatas, description, extraData, 0, proposer, deadline, sig);

        assertEq(draftId, 1);

        (, address dProposer, , , , , , , ) = registry.getDraft(draftId);
        assertEq(dProposer, proposer);

        // Nonce should have been consumed
        assertEq(registry.nonces(proposer), 1);
    }

    function testPublishDraftBySigExpired() public {
        uint256 deadline = block.timestamp - 1; // already expired

        bytes memory sig = _signDraft(
            proposerKey,
            executor,
            targets,
            values,
            calldatas,
            description,
            extraData,
            0,
            proposer,
            0,
            deadline
        );

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(CalldataRegistry.DeadlineExpired.selector, deadline));
        registry.publishDraftBySig(executor, targets, values, calldatas, description, extraData, 0, proposer, deadline, sig);
    }

    function testPublishDraftBySigInvalidSignature() public {
        uint256 deadline = block.timestamp + 1 hours;

        // Sign with a different private key
        (, uint256 wrongKey) = makeAddrAndKey("wrongSigner");
        bytes memory sig = _signDraft(
            wrongKey,
            executor,
            targets,
            values,
            calldatas,
            description,
            extraData,
            0,
            proposer,
            0,
            deadline
        );

        vm.prank(relayer);
        vm.expectRevert(CalldataRegistry.InvalidSignature.selector);
        registry.publishDraftBySig(executor, targets, values, calldatas, description, extraData, 0, proposer, deadline, sig);
    }

    function testPublishDraftBySigReplayProtection() public {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = registry.nonces(proposer);

        bytes memory sig = _signDraft(
            proposerKey,
            executor,
            targets,
            values,
            calldatas,
            description,
            extraData,
            0,
            proposer,
            nonce,
            deadline
        );

        // First call succeeds
        vm.prank(relayer);
        registry.publishDraftBySig(executor, targets, values, calldatas, description, extraData, 0, proposer, deadline, sig);

        // Replay with same signature should fail (nonce already consumed, signature won't match new nonce)
        vm.prank(relayer);
        vm.expectRevert(CalldataRegistry.InvalidSignature.selector);
        registry.publishDraftBySig(executor, targets, values, calldatas, description, extraData, 0, proposer, deadline, sig);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Views
    // ═══════════════════════════════════════════════════════════════════

    function testGetDraft() public {
        vm.prank(proposer);
        uint256 draftId = registry.publishDraft(executor, targets, values, calldatas, description, extraData, 0);

        (
            address dExecutor,
            address dProposer,
            address[] memory dTargets,
            uint256[] memory dValues,
            bytes[] memory dCalldatas,
            string memory dDescription,
            bytes memory dExtraData,
            uint256 dPreviousVersion,
            uint256 dTimestamp
        ) = registry.getDraft(draftId);

        assertEq(dExecutor, executor);
        assertEq(dProposer, proposer);
        assertEq(dTargets.length, 2);
        assertEq(dValues.length, 2);
        assertEq(dCalldatas.length, 2);
        assertEq(dDescription, description);
        assertEq(dExtraData, extraData);
        assertEq(dPreviousVersion, 0);
        assertEq(dTimestamp, block.timestamp);
    }

    function testGetDraftNonExistent() public view {
        (
            address dExecutor,
            address dProposer,
            address[] memory dTargets,
            uint256[] memory dValues,
            bytes[] memory dCalldatas,
            string memory dDescription,
            bytes memory dExtraData,
            uint256 dPreviousVersion,
            uint256 dTimestamp
        ) = registry.getDraft(999);

        assertEq(dExecutor, address(0));
        assertEq(dProposer, address(0));
        assertEq(dTargets.length, 0);
        assertEq(dValues.length, 0);
        assertEq(dCalldatas.length, 0);
        assertEq(dDescription, "");
        assertEq(dExtraData, hex"");
        assertEq(dPreviousVersion, 0);
        assertEq(dTimestamp, 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Nonces
    // ═══════════════════════════════════════════════════════════════════

    function testNoncesInitiallyZero() public view {
        assertEq(registry.nonces(proposer), 0);
    }

    function testNoncesIncrementAfterBySig() public {
        assertEq(registry.nonces(proposer), 0);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signDraft(
            proposerKey, executor, targets, values, calldatas, description, extraData, 0, proposer, 0, deadline
        );

        vm.prank(relayer);
        registry.publishDraftBySig(executor, targets, values, calldatas, description, extraData, 0, proposer, deadline, sig);

        assertEq(registry.nonces(proposer), 1);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Draft ID Sequencing
    // ═══════════════════════════════════════════════════════════════════

    function testDraftIdSequencing() public {
        vm.startPrank(proposer);

        uint256 id1 = registry.publishDraft(executor, targets, values, calldatas, "Draft 1", extraData, 0);
        uint256 id2 = registry.publishDraft(executor, targets, values, calldatas, "Draft 2", extraData, 0);
        uint256 id3 = registry.publishDraft(executor, targets, values, calldatas, "Draft 3", extraData, 0);

        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Edge Cases
    // ═══════════════════════════════════════════════════════════════════

    function testPublishDraftEmptyArrays() public {
        address[] memory emptyTargets = new address[](0);
        uint256[] memory emptyValues = new uint256[](0);
        bytes[] memory emptyCalldatas = new bytes[](0);

        vm.prank(proposer);
        uint256 draftId = registry.publishDraft(executor, emptyTargets, emptyValues, emptyCalldatas, description, extraData, 0);

        (, , address[] memory dTargets, uint256[] memory dValues, bytes[] memory dCalldatas, , , , ) =
            registry.getDraft(draftId);

        assertEq(dTargets.length, 0);
        assertEq(dValues.length, 0);
        assertEq(dCalldatas.length, 0);
    }

    function testPublishDraftBySigWithPreviousVersion() public {
        // First: publish a draft directly
        vm.prank(proposer);
        uint256 firstId = registry.publishDraft(executor, targets, values, calldatas, description, extraData, 0);

        // Now publish by sig referencing the first
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = registry.nonces(proposer);

        bytes memory sig = _signDraft(
            proposerKey, executor, targets, values, calldatas, "Updated via sig", extraData, firstId, proposer, nonce, deadline
        );

        vm.prank(relayer);
        uint256 secondId = registry.publishDraftBySig(
            executor, targets, values, calldatas, "Updated via sig", extraData, firstId, proposer, deadline, sig
        );

        (, , , , , , , uint256 prevVersion, ) = registry.getDraft(secondId);
        assertEq(prevVersion, firstId);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Additional Tests
    // ═══════════════════════════════════════════════════════════════════

    function testPublishDraftBySigWithContractWallet() public {
        // Create a contract wallet whose owner is the proposer EOA
        MockERC1271Wallet wallet = new MockERC1271Wallet(proposer);

        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = registry.nonces(address(wallet));

        // Sign as the EOA owner of the wallet, but set proposer = wallet address
        bytes memory sig = _signDraft(
            proposerKey,
            executor,
            targets,
            values,
            calldatas,
            description,
            extraData,
            0,
            address(wallet),
            nonce,
            deadline
        );

        vm.prank(relayer);
        uint256 draftId = registry.publishDraftBySig(
            executor, targets, values, calldatas, description, extraData, 0, address(wallet), deadline, sig
        );

        assertEq(draftId, 1);

        (, address dProposer, , , , , , , ) = registry.getDraft(draftId);
        assertEq(dProposer, address(wallet));

        // Nonce of the contract wallet should have been consumed
        assertEq(registry.nonces(address(wallet)), 1);
    }

    function testPublishDraftBySigTamperedParameters() public {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = registry.nonces(proposer);

        // Sign with the original description
        bytes memory sig = _signDraft(
            proposerKey,
            executor,
            targets,
            values,
            calldatas,
            description,
            extraData,
            0,
            proposer,
            nonce,
            deadline
        );

        // Call with a different description
        vm.prank(relayer);
        vm.expectRevert(CalldataRegistry.InvalidSignature.selector);
        registry.publishDraftBySig(
            executor, targets, values, calldatas, "Tampered description", extraData, 0, proposer, deadline, sig
        );
    }

    function testPublishDraftBySigDeadlineExact() public {
        // deadline == block.timestamp should be valid (not expired)
        uint256 deadline = block.timestamp;
        uint256 nonce = registry.nonces(proposer);

        bytes memory sig = _signDraft(
            proposerKey,
            executor,
            targets,
            values,
            calldatas,
            description,
            extraData,
            0,
            proposer,
            nonce,
            deadline
        );

        vm.prank(relayer);
        uint256 draftId = registry.publishDraftBySig(
            executor, targets, values, calldatas, description, extraData, 0, proposer, deadline, sig
        );
        assertEq(draftId, 1);
    }

    function testTypehashMatchesExpected() public view {
        bytes32 expected = keccak256(
            "DraftPublish(address executor,bytes32 actionsHash,bytes32 descriptionHash,bytes32 extraDataHash,uint256 previousVersion,address proposer,uint256 nonce,uint256 deadline)"
        );
        assertEq(registry.DRAFT_PUBLISH_TYPEHASH(), expected);
    }

    function testGetDraftZero() public view {
        (
            address dExecutor,
            address dProposer,
            address[] memory dTargets,
            uint256[] memory dValues,
            bytes[] memory dCalldatas,
            string memory dDescription,
            bytes memory dExtraData,
            uint256 dPreviousVersion,
            uint256 dTimestamp
        ) = registry.getDraft(0);

        assertEq(dExecutor, address(0));
        assertEq(dProposer, address(0));
        assertEq(dTargets.length, 0);
        assertEq(dValues.length, 0);
        assertEq(dCalldatas.length, 0);
        assertEq(dDescription, "");
        assertEq(dExtraData, hex"");
        assertEq(dPreviousVersion, 0);
        assertEq(dTimestamp, 0);
    }

    function testMultipleProposersIndependentNonces() public {
        (address proposerB, uint256 proposerBKey) = makeAddrAndKey("proposerB");

        // Both start at nonce 0
        assertEq(registry.nonces(proposer), 0);
        assertEq(registry.nonces(proposerB), 0);

        // Proposer A publishes via BySig
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sigA = _signDraft(
            proposerKey, executor, targets, values, calldatas, description, extraData, 0, proposer, 0, deadline
        );

        vm.prank(relayer);
        registry.publishDraftBySig(executor, targets, values, calldatas, description, extraData, 0, proposer, deadline, sigA);

        // Proposer A's nonce incremented, proposer B's unchanged
        assertEq(registry.nonces(proposer), 1);
        assertEq(registry.nonces(proposerB), 0);

        // Proposer B publishes via BySig
        bytes memory sigB = _signDraft(
            proposerBKey, executor, targets, values, calldatas, description, extraData, 0, proposerB, 0, deadline
        );

        vm.prank(relayer);
        registry.publishDraftBySig(executor, targets, values, calldatas, description, extraData, 0, proposerB, deadline, sigB);

        // Each nonce is independent
        assertEq(registry.nonces(proposer), 1);
        assertEq(registry.nonces(proposerB), 1);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════

    function _signDraft(
        uint256 privateKey,
        address _executor,
        address[] memory _targets,
        uint256[] memory _values,
        bytes[] memory _calldatas,
        string memory _description,
        bytes memory _extraData,
        uint256 previousVersion,
        address _proposer,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 actionsHash = keccak256(abi.encode(_targets, _values, _calldatas));
        bytes32 descriptionHash = keccak256(bytes(_description));
        bytes32 extraDataHash = keccak256(_extraData);

        bytes32 structHash = keccak256(
            abi.encode(
                registry.DRAFT_PUBLISH_TYPEHASH(),
                _executor,
                actionsHash,
                descriptionHash,
                extraDataHash,
                previousVersion,
                _proposer,
                nonce,
                deadline
            )
        );

        bytes32 digest = _computeDigest(structHash);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _computeDigest(bytes32 structHash) internal view returns (bytes32) {
        // Get domain separator fields from EIP-5267
        (
            ,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            ,
        ) = registry.eip712Domain();

        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );

        return MessageHashUtils.toTypedDataHash(domainSeparator, structHash);
    }
}
