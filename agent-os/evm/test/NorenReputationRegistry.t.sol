// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {NorenReputationRegistry} from "../contracts/NorenReputationRegistry.sol";

/// Cross-language parity: a reputation score signed by noren-attestation's
/// `reputation.rs` verifies here, its malleable twins revert, and the thin
/// store keeps the freshest score. Constants are the golden vector from
/// `cargo run -p noren-attestation --example reputation_vector` (fixed key
/// [7;32]). Regenerate them if reputation.rs changes.
///
/// Note the absence of `vm.chainId`: the domain is chain-agnostic (constant
/// salt), so the same signature verifies regardless of `block.chainid` — the
/// property that lets one score be posted on 4663, Base, and anywhere else.
contract NorenReputationRegistryTest is Test {
    uint256 constant N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    address constant ATTESTOR = 0x4a62316623ad457F02cDC5D997deD67a383EC569;

    bytes32 constant SUBJECT = 0xabababababababababababababababababababababababababababababababab;
    uint32 constant SCORE = 9_500;
    uint8 constant SCORE_DECIMALS = 4;
    uint64 constant VALID_UNTIL = 1_700_003_600;
    bytes32 constant ANCHOR_ATTESTATION =
        0x2222222222222222222222222222222222222222222222222222222222222222;

    bytes32 constant DOMAIN_SEPARATOR =
        0x41ccb0a5a371951976cce9708c95981bed3a8a083535516b53b8a709dbb6c3bf;
    bytes32 constant DIGEST = 0x7561184d5b8191c7dd27a31e6c26d4a2000dbabe4452896f12531aa889f6e722;

    uint8 constant V = 27;
    bytes32 constant R = 0xb4f195d18d74c4e2a4f3d8d22f77cb2aa45d2f129554173b9002bd42628ea84b;
    bytes32 constant S = 0x539eb9c1d8b32f6d93e7092b0d440910ef0c114e78817126c7d61e514f1b5cef;

    event ReputationPosted(
        bytes32 indexed subject,
        uint32 score,
        uint8 scoreDecimals,
        uint64 validUntil,
        bytes32 anchorAttestation
    );

    function _rep() internal pure returns (NorenReputationRegistry.Reputation memory) {
        return NorenReputationRegistry.Reputation({
            subject: SUBJECT,
            score: SCORE,
            scoreDecimals: SCORE_DECIMALS,
            validUntil: VALID_UNTIL,
            sourceChain: "eip155:4663",
            anchorAttestation: ANCHOR_ATTESTATION
        });
    }

    function setUp() public {
        vm.warp(1_700_000_000); // before validUntil
    }

    function test_Golden_ReputationDigest() public {
        NorenReputationRegistry reg = new NorenReputationRegistry(ATTESTOR);
        assertEq(reg.domainSeparator(), DOMAIN_SEPARATOR);
        assertEq(reg.digest(_rep()), DIGEST);
    }

    function test_verify_accepts_and_returns_score() public {
        NorenReputationRegistry reg = new NorenReputationRegistry(ATTESTOR);
        (uint32 score, uint8 decimals) = reg.verify(_rep(), V, R, S);
        assertEq(score, SCORE);
        assertEq(decimals, SCORE_DECIMALS);
    }

    function test_verify_rejects_high_s() public {
        NorenReputationRegistry reg = new NorenReputationRegistry(ATTESTOR);
        bytes32 highS = bytes32(N - uint256(S));
        uint8 flipped = V == 27 ? 28 : 27;
        vm.expectRevert(NorenReputationRegistry.MalleableSignature.selector);
        reg.verify(_rep(), flipped, R, highS);
    }

    function test_verify_rejects_bad_v() public {
        NorenReputationRegistry reg = new NorenReputationRegistry(ATTESTOR);
        vm.expectRevert(NorenReputationRegistry.MalleableSignature.selector);
        reg.verify(_rep(), 29, R, S);
    }

    function test_verify_rejects_untrusted_signer() public {
        NorenReputationRegistry reg = new NorenReputationRegistry(address(0xBEEF));
        vm.expectRevert(NorenReputationRegistry.UntrustedSigner.selector);
        reg.verify(_rep(), V, R, S);
    }

    function test_verify_rejects_expired() public {
        NorenReputationRegistry reg = new NorenReputationRegistry(ATTESTOR);
        vm.warp(uint256(VALID_UNTIL) + 1);
        vm.expectRevert(NorenReputationRegistry.Expired.selector);
        reg.verify(_rep(), V, R, S);
    }

    function test_postReputation_stores_and_emits() public {
        NorenReputationRegistry reg = new NorenReputationRegistry(ATTESTOR);
        vm.expectEmit(true, false, false, true);
        emit ReputationPosted(SUBJECT, SCORE, SCORE_DECIMALS, VALID_UNTIL, ANCHOR_ATTESTATION);
        reg.postReputation(_rep(), V, R, S);

        (uint32 score, uint8 decimals, uint64 validUntil, bytes32 anchor, uint64 postedAt) =
            reg.latest(SUBJECT);
        assertEq(score, SCORE);
        assertEq(decimals, SCORE_DECIMALS);
        assertEq(validUntil, VALID_UNTIL);
        assertEq(anchor, ANCHOR_ATTESTATION);
        assertEq(postedAt, 1_700_000_000);
    }

    function test_postReputation_rejects_stale() public {
        NorenReputationRegistry reg = new NorenReputationRegistry(ATTESTOR);
        reg.postReputation(_rep(), V, R, S);
        // Re-posting the same score (equal validUntil) is not fresher.
        vm.expectRevert(NorenReputationRegistry.StaleUpdate.selector);
        reg.postReputation(_rep(), V, R, S);
    }
}
