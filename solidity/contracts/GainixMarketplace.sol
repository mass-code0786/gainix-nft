// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {IGainixNFT} from "./interfaces/IGainixNFT.sol";
import {GainixErrors} from "./libraries/GainixErrors.sol";

/// @title GainixMarketplace
/// @notice Escrow marketplace for ERC-721 listings on BNB Smart Chain.
contract GainixMarketplace is Ownable2Step, ReentrancyGuard, Pausable, IERC721Receiver {
    struct Listing {
        uint256 listingId;
        address nftContract;
        uint256 tokenId;
        address seller;
        uint256 price;
        bool isActive;
        uint64 createdAt;
        uint64 updatedAt;
    }

    uint96 public constant MAX_FEE_BPS = 1_000; // 10%

    uint256 public nextListingId = 1;
    uint96 public marketplaceFeeBps;
    address public feeRecipient;

    mapping(uint256 => Listing) public listings;
    mapping(address => mapping(uint256 => uint256)) public activeListingIdByToken;

    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        uint256 price,
        address indexed nftContract,
        uint256 tokenId,
        uint256 timestamp
    );
    event ListingCancelled(uint256 indexed listingId, address indexed seller, uint256 timestamp);
    event ListingFilled(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 price,
        address indexed seller,
        uint256 feePaid,
        uint256 timestamp
    );
    event MarketplaceFeeUpdated(uint96 oldFeeBps, uint96 newFeeBps);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    constructor(address initialOwner, address initialFeeRecipient, uint96 initialFeeBps) Ownable(initialOwner) {
        if (initialOwner == address(0) || initialFeeRecipient == address(0)) {
            revert GainixErrors.ZeroAddress();
        }
        if (initialFeeBps > MAX_FEE_BPS) revert GainixErrors.InvalidAmount();

        feeRecipient = initialFeeRecipient;
        marketplaceFeeBps = initialFeeBps;
    }

    /// @notice Create an active listing and transfer NFT into escrow.
    function listItem(address nftContract, uint256 tokenId, uint256 price) external whenNotPaused {
        if (nftContract == address(0)) revert GainixErrors.ZeroAddress();
        if (price == 0) revert GainixErrors.InvalidPrice();

        uint256 activeId = activeListingIdByToken[nftContract][tokenId];
        if (activeId != 0 && listings[activeId].isActive) revert GainixErrors.AlreadyListed();

        IGainixNFT nft = IGainixNFT(nftContract);
        if (nft.ownerOf(tokenId) != msg.sender) revert GainixErrors.Unauthorized();

        uint256 listingId = nextListingId;
        unchecked {
            nextListingId = listingId + 1;
        }

        listings[listingId] = Listing({
            listingId: listingId,
            nftContract: nftContract,
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            isActive: true,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });

        activeListingIdByToken[nftContract][tokenId] = listingId;

        nft.safeTransferFrom(msg.sender, address(this), tokenId);

        emit ListingCreated(listingId, msg.sender, price, nftContract, tokenId, block.timestamp);
    }

    /// @notice Cancel active listing and return NFT to seller.
    function cancelListing(uint256 listingId) external nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        if (listing.listingId == 0) revert GainixErrors.ListingNotFound();
        if (!listing.isActive) revert GainixErrors.ListingNotActive();

        bool canCancel = msg.sender == listing.seller || msg.sender == owner();
        if (!canCancel) revert GainixErrors.Unauthorized();

        listing.isActive = false;
        listing.updatedAt = uint64(block.timestamp);
        activeListingIdByToken[listing.nftContract][listing.tokenId] = 0;

        IGainixNFT(listing.nftContract).safeTransferFrom(address(this), listing.seller, listing.tokenId);

        emit ListingCancelled(listingId, listing.seller, block.timestamp);
    }

    /// @notice Buy an active listing by paying exact or greater amount; any overpayment is refunded.
    function buyItem(uint256 listingId) external payable nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        if (listing.listingId == 0) revert GainixErrors.ListingNotFound();
        if (!listing.isActive) revert GainixErrors.ListingNotActive();

        uint256 price = listing.price;
        if (msg.value < price) revert GainixErrors.InsufficientPayment(price, msg.value);

        listing.isActive = false;
        listing.updatedAt = uint64(block.timestamp);
        activeListingIdByToken[listing.nftContract][listing.tokenId] = 0;

        uint256 fee = (price * marketplaceFeeBps) / 10_000;
        uint256 sellerPayout = price - fee;

        IGainixNFT(listing.nftContract).safeTransferFrom(address(this), msg.sender, listing.tokenId);

        (bool sellerSent, ) = payable(listing.seller).call{value: sellerPayout}("");
        if (!sellerSent) revert GainixErrors.InvalidAmount();

        if (fee > 0) {
            (bool feeSent, ) = payable(feeRecipient).call{value: fee}("");
            if (!feeSent) revert GainixErrors.InvalidAmount();
        }

        uint256 refund = msg.value - price;
        if (refund > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: refund}("");
            if (!refunded) revert GainixErrors.InvalidAmount();
        }

        emit ListingFilled(listingId, msg.sender, price, listing.seller, fee, block.timestamp);
    }

    function updateMarketplaceFee(uint96 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert GainixErrors.InvalidAmount();
        uint96 old = marketplaceFeeBps;
        marketplaceFeeBps = newFeeBps;
        emit MarketplaceFeeUpdated(old, newFeeBps);
    }

    function updateFeeRecipient(address newFeeRecipient) external onlyOwner {
        if (newFeeRecipient == address(0)) revert GainixErrors.ZeroAddress();
        address old = feeRecipient;
        feeRecipient = newFeeRecipient;
        emit FeeRecipientUpdated(old, newFeeRecipient);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
