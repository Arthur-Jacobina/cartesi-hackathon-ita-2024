// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Strings.sol";


contract PokemonERC1155Impl is ERC1155 {
    uint256 public constant Bulbasaur = 1;
    uint256 public constant Ivysaur = 2;
    constructor() ERC1155("https://peach-historical-chameleon-866.mypinata.cloud/ipfs/QmcMUNkDdaS58o1ZeqNRTjfNHyfsHAogutPznvjxJ94W2Q/{id}.json") {
        _mint(msg.sender, Bulbasaur, 1, "");
        _mint(msg.sender, Ivysaur, 1, "");
    }

    function uri(uint256 _tokenid) override public pure returns (string memory) {
    return string(
        abi.encodePacked(
            "https://ipfs.io/ipfs/bafybeihjjkwdrxxjnuwevlqtqmh3iegcadc32sio4wmo7bv2gbf34qs34a/",
            Strings.toString(_tokenid),".json"
            )
        );
    }
}