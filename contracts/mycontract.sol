// SPDX-License-Identifier: UNLICENSED

// DO NOT MODIFY BELOW THIS
pragma solidity ^0.8.17;

import "hardhat/console.sol";

contract Splitwise {
    struct IOU {
        address creditor;
        int32 amount;
        uint creditor_id;
        bool valid;
    }

    struct Debtor {
        IOU[] IOUs;
        address debtor;
        uint id;
        bool valid;
    }

    mapping(address => mapping(address => IOU)) iouMap;
    mapping(address => Debtor) debtorMap;
    Debtor[] ledgerArray;

    function add_IOU(
        address _creditor,
        int32 _amount
    ) public returns (bool res) {
        require(msg.sender != _creditor, "cannot owe to self");

        if (debtorMap[msg.sender].valid == false) {
            IOU memory _IOU = IOU({
                creditor: _creditor,
                amount: _amount,
                creditor_id: 0,
                valid: true
            });

            Debtor storage debtor = debtorMap[msg.sender];
            iouMap[msg.sender][_creditor] = _IOU;
            debtor.IOUs.push(_IOU);
            debtor.debtor = msg.sender;
            debtor.id = ledgerArray.length;
            debtor.valid = true;
            ledgerArray.push(debtor);

            debtorMap[msg.sender] = debtor;
            return true;
        } else if (iouMap[msg.sender][_creditor].valid == false) {
            IOU memory _IOU = IOU({
                creditor: _creditor,
                amount: _amount,
                creditor_id: ledgerArray[debtorMap[msg.sender].id].IOUs.length,
                valid: true
            });

            iouMap[msg.sender][_creditor] = _IOU;
            ledgerArray[debtorMap[msg.sender].id].IOUs.push(_IOU);

            return true;
        } else {
            require(
                iouMap[msg.sender][_creditor].amount + _amount >= 0,
                "negative IOU"
            );
            iouMap[msg.sender][_creditor].amount += _amount;
            ledgerArray[debtorMap[msg.sender].id]
                .IOUs[iouMap[msg.sender][_creditor].creditor_id]
                .amount += _amount;

            if (iouMap[msg.sender][_creditor].amount == 0) {
                iouMap[msg.sender][_creditor].valid = false;
                ledgerArray[debtorMap[msg.sender].id]
                    .IOUs[iouMap[msg.sender][_creditor].creditor_id]
                    .valid = false;
            } else {
                iouMap[msg.sender][_creditor].valid = true;
                ledgerArray[debtorMap[msg.sender].id]
                    .IOUs[iouMap[msg.sender][_creditor].creditor_id]
                    .valid = true;
            }
            return true;
        }
    }

    function getLedger() public view returns (Debtor[] memory _ledgerArr) {
        return ledgerArray;
    }

    function lookup(
        address debtor,
        address creditor
    ) public view returns (int32 ret) {
        return iouMap[debtor][creditor].amount;
    }
}
