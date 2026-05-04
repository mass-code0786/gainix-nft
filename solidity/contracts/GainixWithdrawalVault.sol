// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {GainixErrors} from "./libraries/GainixErrors.sol";

/// @title GainixWithdrawalVault
/// @notice Withdrawal vault. Users pay gas to claim operator-authorized native or USDT withdrawal amounts.
contract GainixWithdrawalVault is Ownable2Step, ReentrancyGuard, Pausable {
    IERC20 public immutable usdtToken;

    mapping(address => bool) public operators;
    mapping(address => uint256) public claimable;
    mapping(address => uint256) public usdtClaimable;

    event OperatorUpdated(address indexed operator, bool isOperator);
    event WithdrawalAuthorized(address indexed user, uint256 amount, bytes32 indexed requestId);
    event WithdrawalExecuted(address indexed user, uint256 amount, uint256 timestamp);
    event USDTWithdrawalAuthorized(address indexed user, uint256 amount, bytes32 indexed requestId);
    event USDTWithdrawalExecuted(address indexed user, uint256 amount, uint256 timestamp);
    event VaultFunded(address indexed sender, uint256 amount);

    modifier onlyOperatorOrOwner() {
        if (msg.sender != owner() && !operators[msg.sender]) {
            revert GainixErrors.Unauthorized();
        }
        _;
    }

    constructor(address initialOwner, address initialUsdtToken) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert GainixErrors.ZeroAddress();
        if (initialUsdtToken == address(0)) revert GainixErrors.ZeroAddress();
        usdtToken = IERC20(initialUsdtToken);
    }

    receive() external payable {
        emit VaultFunded(msg.sender, msg.value);
    }

    function setOperator(address operator, bool isOperator) external onlyOwner {
        if (operator == address(0)) revert GainixErrors.ZeroAddress();
        operators[operator] = isOperator;
        emit OperatorUpdated(operator, isOperator);
    }

    function authorizeWithdrawal(address user, uint256 amount, bytes32 requestId) external onlyOperatorOrOwner whenNotPaused {
        if (user == address(0)) revert GainixErrors.ZeroAddress();
        if (amount == 0) revert GainixErrors.InvalidAmount();
        claimable[user] += amount;
        emit WithdrawalAuthorized(user, amount, requestId);
    }

    function authorizeUSDTWithdrawal(address user, uint256 amount, bytes32 requestId) external onlyOperatorOrOwner whenNotPaused {
        if (user == address(0)) revert GainixErrors.ZeroAddress();
        if (amount == 0) revert GainixErrors.InvalidAmount();
        usdtClaimable[user] += amount;
        emit USDTWithdrawalAuthorized(user, amount, requestId);
    }

    /// @notice User-paid gas withdrawal. `amount` must already be authorized into `claimable[user]`.
    function withdraw(address user, uint256 amount) external nonReentrant whenNotPaused {
        if (user == address(0)) revert GainixErrors.ZeroAddress();
        if (msg.sender != user) revert GainixErrors.Unauthorized();
        if (amount == 0 || claimable[user] < amount || address(this).balance < amount) {
            revert GainixErrors.InvalidAmount();
        }

        claimable[user] -= amount;
        (bool sent, ) = payable(user).call{value: amount}("");
        if (!sent) revert GainixErrors.InvalidAmount();

        emit WithdrawalExecuted(user, amount, block.timestamp);
    }

    /// @notice User-paid gas USDT withdrawal. `amount` must already be authorized into `usdtClaimable[user]`.
    function withdrawUSDT(address user, uint256 amount) external nonReentrant whenNotPaused {
        if (user == address(0)) revert GainixErrors.ZeroAddress();
        if (msg.sender != user) revert GainixErrors.Unauthorized();
        if (amount == 0 || usdtClaimable[user] < amount || usdtToken.balanceOf(address(this)) < amount) {
            revert GainixErrors.InvalidAmount();
        }

        usdtClaimable[user] -= amount;
        bool sent = usdtToken.transfer(user, amount);
        if (!sent) revert GainixErrors.InvalidAmount();

        emit USDTWithdrawalExecuted(user, amount, block.timestamp);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
