"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.sendSignedTransaction = exports.getRandomUniqueNumber = exports.getUnixTs = exports.waitForNewBlock = exports.sendV0Transaction = exports.initializeLookupTable = exports.sleep = void 0;
const web3 = __importStar(require("@solana/web3.js"));
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => setTimeout(resolve, ms));
    });
}
exports.sleep = sleep;
function initializeLookupTable(user, connection, addresses) {
    return __awaiter(this, void 0, void 0, function* () {
        const slot = yield connection.getSlot();
        const [lookupTableInst, lookupTableAddress] = web3.AddressLookupTableProgram.createLookupTable({
            authority: user.publicKey,
            payer: user.publicKey,
            recentSlot: slot - 10,
        });
        console.log("lookup table address:", lookupTableAddress.toBase58());
        const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
            payer: user.publicKey,
            authority: user.publicKey,
            lookupTable: lookupTableAddress,
            addresses: addresses.slice(0, 30),
        });
        yield sendV0Transaction(connection, user, [
            lookupTableInst,
            extendInstruction,
        ]);
        var remaining = addresses.slice(30);
        while (remaining.length > 0) {
            const toAdd = remaining.slice(0, 30);
            remaining = remaining.slice(30);
            const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
                payer: user.publicKey,
                authority: user.publicKey,
                lookupTable: lookupTableAddress,
                addresses: toAdd,
            });
            yield sendV0Transaction(connection, user, [extendInstruction]);
        }
        return lookupTableAddress;
    });
}
exports.initializeLookupTable = initializeLookupTable;
function sendV0Transaction(connection, user, instructions, lookupTableAccounts) {
    return __awaiter(this, void 0, void 0, function* () {
        const { lastValidBlockHeight, blockhash } = yield connection.getLatestBlockhash();
        const messageV0 = new web3.TransactionMessage({
            payerKey: user.publicKey,
            recentBlockhash: blockhash,
            instructions,
        }).compileToV0Message(lookupTableAccounts);
        console.log('Create a new transaction object with the message');
        const transaction = new web3.VersionedTransaction(messageV0);
        transaction.sign([user]);
        const txid = yield connection.sendTransaction(transaction);
        console.log('Sent transaction object with the id ' + txid);
        yield connection.confirmTransaction({
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight,
            signature: txid,
        }, "finalized");
        console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
        return txid;
    });
}
exports.sendV0Transaction = sendV0Transaction;
function waitForNewBlock(connection, targetHeight) {
    console.log(`Waiting for ${targetHeight} new blocks`);
    return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
        const { lastValidBlockHeight } = yield connection.getLatestBlockhash();
        const intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            const { lastValidBlockHeight: newValidBlockHeight } = yield connection.getLatestBlockhash();
            if (newValidBlockHeight > lastValidBlockHeight + targetHeight) {
                clearInterval(intervalId);
                resolve();
            }
        }), 1000);
    }));
}
exports.waitForNewBlock = waitForNewBlock;
const getUnixTs = () => {
    return new Date().getTime() / 1000;
};
exports.getUnixTs = getUnixTs;
function getRandomUniqueNumber(min, max, precision) {
    const precisionFactor = Math.pow(10, precision);
    const uniqueNumbers = new Set();
    while (true) {
        const randomNumber = Math.floor(Math.random() * (max * precisionFactor - min * precisionFactor + 1) + min * precisionFactor) / precisionFactor;
        if (!uniqueNumbers.has(randomNumber)) {
            uniqueNumbers.add(randomNumber);
            return randomNumber;
        }
    }
}
exports.getRandomUniqueNumber = getRandomUniqueNumber;
function sendSignedTransaction(_a) {
    return __awaiter(this, arguments, void 0, function* ({ signedTransaction, connection, successCallback, sendingCallback, confirmStatus, timeout = 30000, skipPreflight = true, }) {
        const rawTransaction = signedTransaction.serialize();
        const startTime = (0, exports.getUnixTs)();
        const txid = yield connection.sendRawTransaction(rawTransaction, {
            skipPreflight,
        });
        sendingCallback && sendingCallback(txid);
        console.log("Started awaiting confirmation for", txid);
        let done = false;
        (() => __awaiter(this, void 0, void 0, function* () {
            while (!done && (0, exports.getUnixTs)() - startTime < timeout) {
                connection.sendRawTransaction(rawTransaction, {
                    skipPreflight: true,
                });
                yield sleep(1000);
            }
        }))();
        try {
            yield awaitTransactionSignatureConfirmation(txid, timeout, connection, confirmStatus);
        }
        catch (err) {
            if (err.timeout) {
                throw new Error("Timed out awaiting confirmation on transaction");
            } 
        }
        finally {
            done = true;
        }
        console.log("Latency", txid, Number((0, exports.getUnixTs)() - startTime).toFixed(0) + 'Seconds');
        successCallback && successCallback(txid);
        return txid;
    });
}
exports.sendSignedTransaction = sendSignedTransaction;
function awaitTransactionSignatureConfirmation(txid, timeout, connection, confirmStatus) {
    return __awaiter(this, void 0, void 0, function* () {
        let done = false;
        const result = yield new Promise((resolve, reject) => {
            (() => __awaiter(this, void 0, void 0, function* () {
                while (!done) {
                    (() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            const signatureStatuses = yield connection.getSignatureStatuses([
                                txid,
                            ]);
                            const result = signatureStatuses && signatureStatuses.value[0];
                            if (!done) {
                                if (!result) {
                                }
                                else if (result.err) {
                                    console.log("REST error for", txid, result.confirmationStatus);
                                    done = true;
                                    confirmStatus(txid, result.confirmationStatus);
                                    reject(result.err);
                                }
                                else if (!(result.confirmations ||
                                    result.confirmationStatus === "confirmed" ||
                                    result.confirmationStatus === "finalized")) {
                                    console.log("REST not confirmed", txid, result.confirmationStatus);
                                    confirmStatus(txid, result.confirmationStatus);
                                }
                                else {
                                    console.log("REST confirmed", txid, result.confirmationStatus);
                                    confirmStatus(txid, result.confirmationStatus);
                                    done = true;
                                    resolve(result);
                                }
                            }
                        }
                        catch (e) {
                            if (!done) {
                                console.log("REST connection error: txid", txid, e);
                            }
                        }
                    }))();
                    yield sleep(1000);
                }
            }))();
        });
        done = true;
        return result;
    });
}
