// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BondReceiptVerifier} from "../contracts/BondReceiptVerifier.sol";

/// Cross-language parity: a bond receipt signed by noren-attestation's
/// `bond.rs` verifies here, and its malleable twins revert. Constants are the
/// golden vector from `cargo run -p noren-attestation --example bond_vector`
/// (fixed key [7;32], Base Sepolia). Regenerate them if bond.rs changes.
contract BondReceiptVerifierTest is Test {
    // secp256k1 group order, for building the high-S twin.
    uint256 constant N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    address constant ATTESTOR = 0x4a62316623ad457F02cDC5D997deD67a383EC569;
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    uint256 constant CHAIN_ID = 84532;

    uint8 constant V = 27;
    bytes32 constant R = 0xba2a961395d5de6317661fc4a147dc94d618a743cc1217443a4beaa5ece3e2b2;
    bytes32 constant S = 0x4ed0253b9fd67342d0f86e7d2d762d9599b936209949d656cfe2461051a5b654;

    function _receipt() internal pure returns (BondReceiptVerifier.BondReceipt memory) {
        return BondReceiptVerifier.BondReceipt({
            subject: 0xabababababababababababababababababababababababababababababababab,
            bondToken: USDC,
            bondAmount: 1_000_000,
            agentReturn: 0x1111111111111111111111111111111111111111,
            slashBeneficiary: 0x2222222222222222222222222222222222222222,
            slashBeneficiaryBps: 8_000,
            nonce: 0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd,
            issuedAt: 1_700_000_000,
            expiry: 1_800_000_000
        });
    }

    function setUp() public {
        vm.chainId(CHAIN_ID); // so domainSeparator's block.chainid matches the vector
        vm.warp(1_750_000_000); // inside [issuedAt, expiry]
    }

    function test_verify_accepts_the_signed_receipt() public {
        BondReceiptVerifier v = new BondReceiptVerifier(ATTESTOR, USDC);
        assertTrue(v.verify(_receipt(), V, R, S));
    }

    function test_verify_rejects_high_s() public {
        BondReceiptVerifier v = new BondReceiptVerifier(ATTESTOR, USDC);
        bytes32 highS = bytes32(N - uint256(S));
        uint8 flipped = V == 27 ? 28 : 27;
        vm.expectRevert(BondReceiptVerifier.MalleableSignature.selector);
        v.verify(_receipt(), flipped, R, highS);
    }

    function test_verify_rejects_bad_v() public {
        BondReceiptVerifier v = new BondReceiptVerifier(ATTESTOR, USDC);
        vm.expectRevert(BondReceiptVerifier.MalleableSignature.selector);
        v.verify(_receipt(), 29, R, S);
    }

    function test_verify_rejects_untrusted_signer() public {
        BondReceiptVerifier v = new BondReceiptVerifier(address(0xBEEF), USDC);
        vm.expectRevert(BondReceiptVerifier.UntrustedSigner.selector);
        v.verify(_receipt(), V, R, S);
    }
}
