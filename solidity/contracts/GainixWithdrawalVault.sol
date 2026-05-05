// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {GainixErrors} from "./libraries/GainixErrors.sol";

/// @title GainixWithdrawalVault
/// @notice Withdrawal vault. Operators can authorize or directly pay USDT withdrawal amounts.
contract GainixWithdrawalVault is Ownable2Step, ReentrancyGuard, Pausable {
    IERC20 public immutable usdtToken;

    mapping(address => bool) public operators;
    mapping(address => uint256) public claimable;
    mapping(address => uint256) public usdtClaimable;
    mapping(bytes32 => bool) public usdtWithdrawalRequests;
    mapping(bytes32 => bool) public processed;

    event OperatorUpdated(address indexed operator, bool isOperator);
    event WithdrawalAuthorized(address indexed user, uint256 amount, bytes32 indexed requestId);
    event WithdrawalExecuted(address indexed user, uint256 amount, uint256 timestamp);
    event USDTWithdrawalAuthorized(address indexed user, uint256 amount, bytes32 indexed requestId);
    event USDTWithdrawalExecuted(address indexed user, uint256 amount, uint256 timestamp);
    event PayoutExecuted(address indexed user, uint256 amount, bytes32 indexed requestId);
    event ERC20Recovered(address indexed token, address indexed to, uint256 amount);
    event VaultFunded(address indexed sender, uint256 amount);

    modifier onlyOperatorOrOwner() {
        if (msg.sender != owner() && !operators[msg.sender]) {
            revert GainixErrors.Unauthorized();
        }
        _;
    }

    constructor(address initialOwner, address initialOperator, address initialUsdtToken) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert GainixErrors.ZeroAddress();
        if (initialOperator == address(0)) revert GainixErrors.ZeroAddress();
        if (initialUsdtToken == address(0)) revert GainixErrors.ZeroAddress();
        usdtToken = IERC20(initialUsdtToken);
        operators[initialOperator] = true;
        emit OperatorUpdated(initialOperator, true);
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
        if (requestId != bytes32(0) && usdtWithdrawalRequests[requestId]) {
            return;
        }
        if (requestId != bytes32(0)) {
            usdtWithdrawalRequests[requestId] = true;
        }
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

    function payoutUSDT(address user, uint256 amount, bytes32 requestId) external onlyOperatorOrOwner nonReentrant whenNotPaused {
        require(user != address(0), "Zero address");
        require(amount > 0, "Invalid amount");
        require(!processed[requestId], "Already processed");
        processed[requestId] = true;

        require(usdtToken.balanceOf(address(this)) >= amount, "Insufficient USDT");

        bool sent = usdtToken.transfer(user, amount);
        require(sent, "USDT transfer failed");

        emit PayoutExecuted(user, amount, requestId);
    }

    function recoverERC20(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) revert GainixErrors.ZeroAddress();
        if (amount == 0) revert GainixErrors.InvalidAmount();

        bool sent = IERC20(token).transfer(owner(), amount);
        if (!sent) revert GainixErrors.InvalidAmount();

        emit ERC20Recovered(token, owner(), amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
