// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CalldataRegistry} from "../src/CalldataRegistry.sol";
import {CalldataReviewResolver} from "../src/CalldataReviewResolver.sol";
import {ICalldataRegistry} from "../src/ICalldataRegistry.sol";
import {IEAS, Attestation, AttestationRequest, AttestationRequestData} from "@eas/contracts/IEAS.sol";
import {ISchemaRegistry, SchemaRecord} from "@eas/contracts/ISchemaRegistry.sol";
import {EAS} from "@eas/contracts/EAS.sol";
import {SchemaRegistry} from "@eas/contracts/SchemaRegistry.sol";

contract CalldataReviewResolverTest is Test {
    CalldataRegistry public registry;
    CalldataReviewResolver public resolver;
    EAS public eas;
    SchemaRegistry public schemaRegistry;

    bytes32 public schemaUID;

    string public constant REVIEW_SCHEMA = "uint256 draftId, bool approved, string comment";

    address public proposer;
    address public reviewer;
    address public reviewer2;

    // Reusable draft parameters
    address[] targets;
    uint256[] values;
    bytes[] calldatas;

    function setUp() public {
        registry = new CalldataRegistry();

        schemaRegistry = new SchemaRegistry();
        eas = new EAS(schemaRegistry);

        resolver = new CalldataReviewResolver(IEAS(address(eas)), ICalldataRegistry(address(registry)));

        schemaUID = schemaRegistry.register(REVIEW_SCHEMA, resolver, false);

        proposer = makeAddr("proposer");
        reviewer = makeAddr("reviewer");
        reviewer2 = makeAddr("reviewer2");

        targets = new address[](1);
        targets[0] = address(0x1111);
        values = new uint256[](1);
        values[0] = 0;
        calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("transfer(address,uint256)", address(0x2222), 100);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════

    function _publishDraft() internal returns (uint256 draftId) {
        vm.prank(proposer);
        draftId = registry.publishDraft(
            address(0xdead), targets, values, calldatas, "Test proposal", hex"", 0
        );
    }

    function _encodeReview(uint256 draftId, bool approved, string memory comment) internal pure returns (bytes memory) {
        return abi.encode(draftId, approved, comment);
    }

    function _attest(address attester, uint256 draftId, bool approved, string memory comment)
        internal
        returns (bytes32 uid)
    {
        vm.prank(attester);
        uid = eas.attest(
            AttestationRequest({
                schema: schemaUID,
                data: AttestationRequestData({
                    recipient: address(0),
                    expirationTime: 0,
                    revocable: false,
                    refUID: bytes32(0),
                    data: _encodeReview(draftId, approved, comment),
                    value: 0
                })
            })
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // Schema Registration
    // ═══════════════════════════════════════════════════════════════════

    function testSchemaRegistered() public view {
        SchemaRecord memory record = schemaRegistry.getSchema(schemaUID);
        assertEq(record.schema, REVIEW_SCHEMA);
        assertFalse(record.revocable);
        assertEq(address(record.resolver), address(resolver));
    }

    // ═══════════════════════════════════════════════════════════════════
    // Successful Attestations
    // ═══════════════════════════════════════════════════════════════════

    function testAttestApproval() public {
        uint256 draftId = _publishDraft();

        vm.expectEmit(false, true, true, true, address(resolver));
        emit CalldataReviewResolver.ReviewCreated(bytes32(0), draftId, reviewer, true, "LGTM");
        bytes32 uid = _attest(reviewer, draftId, true, "LGTM");

        Attestation memory att = eas.getAttestation(uid);
        assertEq(att.attester, reviewer);
        assertEq(att.schema, schemaUID);

        (uint256 decodedDraftId, bool approved, string memory comment) =
            abi.decode(att.data, (uint256, bool, string));
        assertEq(decodedDraftId, draftId);
        assertTrue(approved);
        assertEq(comment, "LGTM");
    }

    function testAttestRejection() public {
        uint256 draftId = _publishDraft();

        bytes32 uid = _attest(reviewer, draftId, false, "Targets wrong contract");

        Attestation memory att = eas.getAttestation(uid);
        (uint256 decodedDraftId, bool approved, string memory comment) =
            abi.decode(att.data, (uint256, bool, string));
        assertEq(decodedDraftId, draftId);
        assertFalse(approved);
        assertEq(comment, "Targets wrong contract");
    }

    function testAttestWithGithubLink() public {
        uint256 draftId = _publishDraft();

        string memory link = "https://github.com/org/repo/blob/main/test/verify-draft-42.t.sol";
        bytes32 uid = _attest(reviewer, draftId, true, link);

        Attestation memory att = eas.getAttestation(uid);
        (, , string memory comment) = abi.decode(att.data, (uint256, bool, string));
        assertEq(comment, link);
    }

    function testAttestEmptyComment() public {
        uint256 draftId = _publishDraft();

        bytes32 uid = _attest(reviewer, draftId, true, "");

        Attestation memory att = eas.getAttestation(uid);
        (, , string memory comment) = abi.decode(att.data, (uint256, bool, string));
        assertEq(comment, "");
    }

    function testMultipleReviewersOnSameDraft() public {
        uint256 draftId = _publishDraft();

        bytes32 uid1 = _attest(reviewer, draftId, true, "Approved by reviewer 1");
        bytes32 uid2 = _attest(reviewer2, draftId, true, "Approved by reviewer 2");

        assertTrue(uid1 != uid2);

        Attestation memory att1 = eas.getAttestation(uid1);
        Attestation memory att2 = eas.getAttestation(uid2);
        assertEq(att1.attester, reviewer);
        assertEq(att2.attester, reviewer2);
    }

    function testSameReviewerMultipleAttestations() public {
        uint256 draftId = _publishDraft();

        bytes32 uid1 = _attest(reviewer, draftId, false, "Not approved yet");
        bytes32 uid2 = _attest(reviewer, draftId, true, "Now approved after fix");

        assertTrue(uid1 != uid2);
        assertTrue(eas.isAttestationValid(uid1));
        assertTrue(eas.isAttestationValid(uid2));
    }

    // ═══════════════════════════════════════════════════════════════════
    // Rejections (Invalid Draft)
    // ═══════════════════════════════════════════════════════════════════

    function testRevertAttestNonExistentDraft() public {
        vm.prank(reviewer);
        vm.expectRevert(abi.encodeWithSelector(CalldataReviewResolver.DraftNotFound.selector, 999));
        eas.attest(
            AttestationRequest({
                schema: schemaUID,
                data: AttestationRequestData({
                    recipient: address(0),
                    expirationTime: 0,
                    revocable: false,
                    refUID: bytes32(0),
                    data: _encodeReview(999, true, "Should fail"),
                    value: 0
                })
            })
        );
    }

    function testRevertAttestDraftIdZero() public {
        vm.prank(reviewer);
        vm.expectRevert(abi.encodeWithSelector(CalldataReviewResolver.DraftNotFound.selector, 0));
        eas.attest(
            AttestationRequest({
                schema: schemaUID,
                data: AttestationRequestData({
                    recipient: address(0),
                    expirationTime: 0,
                    revocable: false,
                    refUID: bytes32(0),
                    data: _encodeReview(0, true, "Draft zero"),
                    value: 0
                })
            })
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // Immutable References
    // ═══════════════════════════════════════════════════════════════════

    function testRegistryReference() public view {
        assertEq(address(resolver.registry()), address(registry));
    }
}
