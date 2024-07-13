"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JitoExecutor = void 0;
const jito_1 = require("./Jito.js");
const types_js_1 = require("jito-ts/dist/sdk/block-engine/types.js");
const web3_js_1 = require("@solana/web3.js");
const constants_1 = require("./constants.js");
const config_1 = require("./constants.js");
class JitoExecutor {
    executeAndConfirmBundle(transactions, payers, latestBlockhash, onAcceptedBundle) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Executing transaction...');
            const bundle = new types_js_1.Bundle(transactions, 5);
            //bundle.addTipTx(payers[0], constants_1.priorityFees * web3_js_1.LAMPORTS_PER_SOL, (0, config_1.getRandomTipAccount)(), latestBlockhash.blockhash);
            const bundleId = jito_1.searcherClients.forEach((searcherClient) => __awaiter(this, void 0, void 0, function* () {
                const bundleId = yield searcherClient
                    .sendBundle(bundle)
                    .then((bundleId) => {
                    console.log(`Bundle ${bundleId} sent, backrunning `);
                    console.log(bundleId);
                    return bundleId;
                }).catch((error) => {
                    var _a;
                    console.log(error, 'Error sending bundle');
                    if ((_a = error === null || error === void 0 ? void 0 : error.message) === null || _a === void 0 ? void 0 : _a.includes('Bundle Dropped, no connected leader up soon')) {
                        console.log('Error sending bundle: Bundle Dropped, no connected leader up soon.');
                    }
                    else {
                        console.log(error, 'Error sending bundle');
                    }
                    return 'Error sending bundle';
                });
                console.log('Checking for Bundle Id ' + bundleId);
                searcherClient.onBundleResult((bundleResult) => {
                    onAcceptedBundle(bundleResult, bundleId);
                }, (error) => {
                    console.log(error);
                    return false;
                });
            }));
            return bundleId;
        });
    }
    constructor() {
    }
    executeTransaction(transaction) {
        throw new Error("Method not implemented.");
    }
    submitBundle(transactions, payers, latestBlockhash, onAcceptedBundle) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Executing transaction...');
            const bundle = new types_js_1.Bundle(transactions, 5);
            bundle.addTipTx(payers[0], constants_1.jitoTips * web3_js_1.LAMPORTS_PER_SOL, (0, config_1.getRandomTipAccount)(), latestBlockhash.blockhash);
            const bundleId = yield jito_1.searcherClient
                .sendBundle(bundle)
                .then((bundleId) => {
                console.log(`Bundle ${bundleId} sent, backrunning `);
                return bundleId;
            }).catch((error) => {
                var _a;
                if ((_a = error === null || error === void 0 ? void 0 : error.message) === null || _a === void 0 ? void 0 : _a.includes('Bundle Dropped, no connected leader up soon')) {
                    console.log('Error sending bundle: Bundle Dropped, no connected leader up soon.');
                }
                else {
                    console.log(new String(error), 'Error sending bundle');
                }
                return 'Error sending bundle';
            });
            console.log('Checking for Bundle Id ' + bundleId);
            jito_1.searcherClient.onBundleResult((bundleResult) => {
                onAcceptedBundle(bundleResult, bundleId);
            }, (error) => {
                console.log(new String(error));
                return false;
            });
            return bundleId;
        });
    }
}
module.exports = JitoExecutor;
