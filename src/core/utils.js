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
exports.sendConfirm = exports.sleep = exports.isLocalhost = exports.getExplorerAccountLink = exports.getUnixTs = exports.sendSignedTransaction = exports.getRandomUniqueNumber = exports.getWalletTokenAccount = exports.getWalletTokenBalance = exports.sell_remove_fees = exports.PRIORITY_FEE_IX = exports.SEND_AMT = exports.escape_markdown = void 0;
const raydium_sdk_1 = require("@raydium-io/raydium-sdk");
const web3_js_1 = require("@solana/web3.js");
const escape_markdown = (text) => {
    return text.replace(/([\.\+\-\|\(\)\#\_\[\]\~\=\{\}\,\!\`\>\<])/g, "\\$1").replaceAll('"', '`');
};
exports.escape_markdown = escape_markdown;
const PRIORITY_RATE = 25000;
exports.SEND_AMT = 0.001 * web3_js_1.LAMPORTS_PER_SOL;
exports.PRIORITY_FEE_IX = web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: exports.SEND_AMT });
exports.sell_remove_fees = 5000000;
function getWalletTokenBalance(connection, wallet, tokenMint) {
    return __awaiter(this, void 0, void 0, function* () {
        const walletTokenAccount = yield connection.getTokenAccountsByOwner(wallet, {
            programId: raydium_sdk_1.TOKEN_PROGRAM_ID,
        });
        const accountInfos = walletTokenAccount.value.filter((i) => raydium_sdk_1.SPL_ACCOUNT_LAYOUT.decode(i.account.data).mint.toBase58().toLowerCase() == tokenMint.toBase58().toLowerCase());
        if (accountInfos.length > 0) {
            console.log(' Token balance Is : ' + raydium_sdk_1.SPL_ACCOUNT_LAYOUT.decode(accountInfos[0].account.data).amount.toString());
            return raydium_sdk_1.SPL_ACCOUNT_LAYOUT.decode(accountInfos[0].account.data).amount.toString();
        }
        else
            return '0';
    });
}
exports.getWalletTokenBalance = getWalletTokenBalance;
function getWalletTokenAccount(connection, wallet, tokenMint) {
    return __awaiter(this, void 0, void 0, function* () {
        const walletTokenAccount = yield connection.getTokenAccountsByOwner(wallet, {
            mint: tokenMint
        });
        return walletTokenAccount.value.map((i) => ({
            pubkey: i.pubkey,
            programId: i.account.owner,
            accountInfo: raydium_sdk_1.SPL_ACCOUNT_LAYOUT.decode(i.account.data),
        }));
    });
}
exports.getWalletTokenAccount = getWalletTokenAccount;
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
            const simulateResult = yield connection.simulateTransaction(signedTransaction);
            if (simulateResult && simulateResult.value.err) {
                if (simulateResult.value.logs) {
                    for (let i = simulateResult.value.logs.length - 1; i >= 0; --i) {
                        const line = simulateResult.value.logs[i];
                        if (line.startsWith("Program log: ")) {
                            throw new Error("Transaction failed: " + line.slice("Program log: ".length));
                        }
                    }
                }
                confirmStatus(txid, 'AlreadyProcessed');
            }
            throw new Error("Transaction failed");
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
const getUnixTs = () => {
    return new Date().getTime() / 1000;
};
exports.getUnixTs = getUnixTs;
function getExplorerAccountLink(account, cluster) {
    return `https://explorer.solana.com/address/${account.toString()}?cluster=${cluster === "mainnet-beta" ? null : cluster}`;
}
exports.getExplorerAccountLink = getExplorerAccountLink;
const isLocalhost = (url) => {
    return url.includes("localhost") || url.includes("127.0.0.1");
};
exports.isLocalhost = isLocalhost;
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => setTimeout(resolve, ms));
    });
}
exports.sleep = sleep;
function sendConfirm(connection, transaction, payers) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { blockhash, lastValidBlockHeight } = yield connection.getLatestBlockhash('finalized');
        let blockheight = yield connection.getBlockHeight('finalized');
        let signature = '';
        while (blockheight < lastValidBlockHeight) {
            if (signature != '') {
                const a = yield connection.getSignatureStatus(signature);
                if (!((_a = a.value) === null || _a === void 0 ? void 0 : _a.err))
                    break;
            }
            const { blockhash, lastValidBlockHeight } = yield connection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;
            transaction.sign(...payers);
            const rawTransaction = transaction.serialize();
            signature = yield connection.sendRawTransaction(rawTransaction, {
                skipPreflight: true,
            });
            console.log(`Signature: ${signature}`);
            yield sleep(1500);
            blockheight = yield connection.getBlockHeight('finalized');
        }
        return { wallet: payers[0].publicKey.toBase58(), signature: signature };
    });
}
exports.sendConfirm = sendConfirm;
