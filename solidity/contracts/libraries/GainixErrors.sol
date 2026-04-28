// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library GainixErrors {
    error ZeroAddress();
    error InvalidAmount();
    error InvalidPrice();
    error Unauthorized();
    error ListingNotFound();
    error ListingNotActive();
    error AlreadyListed();
    error InsufficientPayment(uint256 expected, uint256 received);
    error PlanNotActive();
    error ArrayLengthMismatch();
}
