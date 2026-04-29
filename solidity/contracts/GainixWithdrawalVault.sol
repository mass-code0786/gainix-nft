// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {GainixErrors} from "./libraries/GainixErrors.sol";

/// @title GainixWithdrawalVault
/// @notice Native-token withdrawal vault. Users pay gas to claim operator-authorized net withdrawal amounts.
contract GainixWithdrawalVault is Ownable2Step, ReentrancyGuard, Pausable {
    mapping(address => bool) public operators;
    mapping(address => uint256) public claimable;

    event OperatorUpdated(address indexed operator, bool isOperator);
    event WithdrawalAuthorized(address indexed user, uint256 amount, bytes32 indexed requestId);
    event WithdrawalExecuted(address indexed user, uint256 amount, uint256 timestamp);
    event VaultFunded(address indexed sender, uint256 amount);

    modifier onlyOperatorOrOwner() {
        if (msg.sender != owner() && !operators[msg.sender]) {
            revert GainixErrors.Unauthorized();
        }
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert GainixErrors.ZeroAddress();
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

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
