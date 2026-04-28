// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

import {GainixErrors} from "./libraries/GainixErrors.sol";

/// @title GainixNFT
/// @notice ERC-721 collection contract with owner/admin mint support and token URI management.
contract GainixNFT is ERC721URIStorage, Ownable2Step {
    uint256 private _nextTokenId;
    string private _baseTokenUri;

    mapping(address => bool) public admins;

    event AdminUpdated(address indexed account, bool isAdmin);
    event AdminMint(address indexed operator, address indexed to, uint256 indexed tokenId, string tokenUri);
    event BaseTokenUriUpdated(string previousBaseUri, string newBaseUri);
    event TokenUriUpdated(uint256 indexed tokenId, string tokenUri);

    modifier onlyAdminOrOwner() {
        if (msg.sender != owner() && !admins[msg.sender]) {
            revert GainixErrors.Unauthorized();
        }
        _;
    }

    /// @param name_ ERC-721 name.
    /// @param symbol_ ERC-721 symbol.
    /// @param initialOwner Contract owner/admin manager.
    /// @param initialBaseTokenUri Optional base URI prefix.
    /// @param startTokenId Starting token id for incremental mints.
    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner,
        string memory initialBaseTokenUri,
        uint256 startTokenId
    ) ERC721(name_, symbol_) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert GainixErrors.ZeroAddress();
        admins[initialOwner] = true;
        _baseTokenUri = initialBaseTokenUri;
        _nextTokenId = startTokenId;

        emit AdminUpdated(initialOwner, true);
    }

    /// @notice Adds or removes an admin wallet that can mint and update token URIs.
    function setAdmin(address account, bool isAdmin) external onlyOwner {
        if (account == address(0)) revert GainixErrors.ZeroAddress();
        admins[account] = isAdmin;
        emit AdminUpdated(account, isAdmin);
    }

    /// @notice Owner can update base URI used as prefix by metadata clients.
    function setBaseTokenUri(string calldata newBaseTokenUri) external onlyOwner {
        string memory previous = _baseTokenUri;
        _baseTokenUri = newBaseTokenUri;
        emit BaseTokenUriUpdated(previous, newBaseTokenUri);
    }

    /// @notice Mints an NFT to `to` and sets token URI.
    /// @dev Admin/owner mint flow used by curation or allowlisted mint backoffice.
    function adminMint(address to, string calldata uri) external onlyAdminOrOwner returns (uint256 tokenId) {
        if (to == address(0)) revert GainixErrors.ZeroAddress();

        tokenId = _nextTokenId;
        unchecked {
            _nextTokenId = tokenId + 1;
        }

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit AdminMint(msg.sender, to, tokenId, uri);
    }

    /// @notice Updates token-level URI for an existing NFT.
    function setTokenUri(uint256 tokenId, string calldata uri) external onlyAdminOrOwner {
        _requireOwned(tokenId);
        _setTokenURI(tokenId, uri);
        emit TokenUriUpdated(tokenId, uri);
    }

    /// @notice Burns a token. Caller must be owner or approved wallet for that token.
    function burn(uint256 tokenId) public {
        address tokenOwner = ownerOf(tokenId);
        if (!_isAuthorized(tokenOwner, msg.sender, tokenId)) {
            revert GainixErrors.Unauthorized();
        }
        _burn(tokenId);
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenUri;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
