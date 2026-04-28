// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {GainixErrors} from "./libraries/GainixErrors.sol";

/// @title GainixBotPass
/// @notice Utility subscription contract for bot execution cycles/trades. No profit guarantees.
contract GainixBotPass is Ownable2Step, ReentrancyGuard, Pausable {
    struct Plan {
        uint256 priceWei;
        uint256 cycles;
        bool active;
    }

    struct Subscription {
        uint256 planId;
        uint256 remainingCycles;
        uint64 startedAt;
        uint64 expiresAt;
        uint256 totalPurchases;
    }

    address public treasury;
    uint64 public subscriptionPeriod = 30 days;

    mapping(uint256 => Plan) public plans;
    mapping(address => Subscription) private _subscriptions;
    mapping(address => bool) public operators;

    event PlanConfigured(uint256 indexed planId, uint256 priceWei, uint256 cycles, bool active);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event OperatorUpdated(address indexed operator, bool isOperator);
    event BotPassPurchased(
        address indexed user,
        uint256 indexed planId,
        uint256 amountPaid,
        uint256 cyclesAdded,
        bool renewal,
        uint256 timestamp
    );
    event SubscriptionUpdated(address indexed user, uint256 planId, uint256 remainingCycles);
    event CycleConsumed(address indexed user, uint256 amount, uint256 remainingCycles);
    event SubscriptionPeriodUpdated(uint64 oldPeriod, uint64 newPeriod);

    modifier onlyOperatorOrOwner() {
        if (msg.sender != owner() && !operators[msg.sender]) {
            revert GainixErrors.Unauthorized();
        }
        _;
    }

    constructor(
        address initialOwner,
        address initialTreasury,
        uint256[] memory planIds,
        uint256[] memory pricesWei,
        uint256[] memory cycles
    ) Ownable(initialOwner) {
        if (initialOwner == address(0) || initialTreasury == address(0)) {
            revert GainixErrors.ZeroAddress();
        }
        if (planIds.length != pricesWei.length || planIds.length != cycles.length) {
            revert GainixErrors.ArrayLengthMismatch();
        }

        treasury = initialTreasury;

        for (uint256 i = 0; i < planIds.length; i++) {
            _setPlan(planIds[i], pricesWei[i], cycles[i], true);
        }
    }

    /// @notice Subscribe or switch plans by paying the selected plan price.
    function subscribe(uint256 planId) external payable nonReentrant whenNotPaused {
        _purchase(planId, false);
    }

    /// @notice Renew current or selected plan by paying the plan price.
    function renewSubscription(uint256 planId) external payable nonReentrant whenNotPaused {
        _purchase(planId, true);
    }

    /// @notice Returns compact subscription shape expected by frontend contract hooks.
    function subscriptionOf(address user) external view returns (uint256 planId, uint256 remainingCycles, bool active) {
        Subscription memory sub = _subscriptions[user];
        active = _isSubscriptionActive(sub);
        return (sub.planId, sub.remainingCycles, active);
    }

    function getSubscription(address user) external view returns (Subscription memory) {
        return _subscriptions[user];
    }

    function consumeCycles(address user, uint256 amount) external onlyOperatorOrOwner whenNotPaused {
        if (user == address(0)) revert GainixErrors.ZeroAddress();
        if (amount == 0) revert GainixErrors.InvalidAmount();

        Subscription storage sub = _subscriptions[user];
        if (!_isSubscriptionActive(sub)) revert GainixErrors.Unauthorized();
        if (sub.remainingCycles < amount) revert GainixErrors.InvalidAmount();

        sub.remainingCycles -= amount;
        emit CycleConsumed(user, amount, sub.remainingCycles);
        emit SubscriptionUpdated(user, sub.planId, sub.remainingCycles);
    }

    function configurePlan(uint256 planId, uint256 priceWei, uint256 cycles, bool active) external onlyOwner {
        _setPlan(planId, priceWei, cycles, active);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert GainixErrors.ZeroAddress();
        address previous = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(previous, newTreasury);
    }

    function setOperator(address operator, bool isOperator) external onlyOwner {
        if (operator == address(0)) revert GainixErrors.ZeroAddress();
        operators[operator] = isOperator;
        emit OperatorUpdated(operator, isOperator);
    }

    function setSubscriptionPeriod(uint64 newPeriod) external onlyOwner {
        if (newPeriod == 0) revert GainixErrors.InvalidAmount();
        uint64 old = subscriptionPeriod;
        subscriptionPeriod = newPeriod;
        emit SubscriptionPeriodUpdated(old, newPeriod);
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) return;

        (bool sent, ) = payable(treasury).call{value: balance}("");
        if (!sent) revert GainixErrors.InvalidAmount();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _purchase(uint256 planId, bool renewal) internal {
        Plan memory plan = plans[planId];
        if (!plan.active) revert GainixErrors.PlanNotActive();
        if (msg.value < plan.priceWei) {
            revert GainixErrors.InsufficientPayment(plan.priceWei, msg.value);
        }

        Subscription storage sub = _subscriptions[msg.sender];

        uint256 newCycles = _isSubscriptionActive(sub) ? sub.remainingCycles + plan.cycles : plan.cycles;

        sub.planId = planId;
        sub.remainingCycles = newCycles;
        sub.startedAt = uint64(block.timestamp);
        sub.expiresAt = uint64(block.timestamp + subscriptionPeriod);
        sub.totalPurchases += 1;

        emit BotPassPurchased(msg.sender, planId, plan.priceWei, plan.cycles, renewal, block.timestamp);
        emit SubscriptionUpdated(msg.sender, sub.planId, sub.remainingCycles);

        uint256 refund = msg.value - plan.priceWei;
        if (refund > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: refund}("");
            if (!refunded) revert GainixErrors.InvalidAmount();
        }
    }

    function _setPlan(uint256 planId, uint256 priceWei, uint256 cycles, bool active) internal {
        if (priceWei == 0 || cycles == 0) revert GainixErrors.InvalidAmount();
        plans[planId] = Plan({priceWei: priceWei, cycles: cycles, active: active});
        emit PlanConfigured(planId, priceWei, cycles, active);
    }

    function _isSubscriptionActive(Subscription memory sub) internal view returns (bool) {
        if (sub.planId == 0 || sub.remainingCycles == 0) return false;
        return sub.expiresAt >= block.timestamp;
    }
}
