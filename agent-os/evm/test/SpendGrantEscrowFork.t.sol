// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SpendGrantEscrow} from "../contracts/SpendGrantEscrow.sol";
import {IERC20} from "../contracts/interfaces/IERC20.sol";
import {DeploySpendGrantEscrow} from "../script/DeploySpendGrantEscrow.s.sol";

/// Fork rehearsal against REAL Robinhood Chain (4663) state and the REAL USDG
/// token. Nothing is broadcast: forge runs this in an in-memory fork. It proves
/// the deploy script works against the live chain before any funds are involved.
///
///   forge test --match-contract SpendGrantEscrowForkTest \
///     --fork-url https://rpc.mainnet.chain.robinhood.com
///
/// Skipped automatically when no fork is configured so the normal suite stays
/// hermetic.
contract SpendGrantEscrowForkTest is Test {
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    address admin = address(0xA11CE);
    address attestor = address(0xA77E57);
    address treasury = address(0x7EA5);
    address emergency = address(0xE3E7);
    address gateway = address(0x6A7E);

    function _forked() internal view returns (bool) {
        return block.chainid == 4663;
    }

    function test_deployScriptRunsAgainstLiveChainAndShipsPaused() public {
        if (!_forked()) return;
        vm.setEnv("USDG", vm.toString(USDG));
        vm.setEnv("ADMIN", vm.toString(admin));
        vm.setEnv("ATTESTOR", vm.toString(attestor));
        vm.setEnv("TREASURY", vm.toString(treasury));
        vm.setEnv("EMERGENCY_ADMIN", vm.toString(emergency));
        vm.setEnv("GATEWAY", vm.toString(gateway));

        DeploySpendGrantEscrow script = new DeploySpendGrantEscrow();
        SpendGrantEscrow escrow = script.run();

        assertEq(block.chainid, 4663, "forked chain id");
        assertTrue(address(escrow).code.length > 0, "escrow has code");
        assertTrue(escrow.paused(), "must ship paused");
    }

    function test_realUsdgTokenBehavesAsAssumed() public {
        if (!_forked()) return;
        IERC20 usd = IERC20(USDG);
        // The production IERC20 interface has no decimals(); read it directly.
        (bool ok, bytes memory data) = USDG.staticcall(abi.encodeWithSignature("decimals()"));
        assertTrue(ok, "decimals() call");
        assertEq(abi.decode(data, (uint8)), 6, "USDG is 6 decimals");
        // Fund a fresh account with the real token via storage-free `deal`.
        address payer = address(0xBEEF);
        deal(USDG, payer, 1_000_000); // 1 USDG
        assertEq(usd.balanceOf(payer), 1_000_000);
    }
}
