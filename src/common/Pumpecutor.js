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
const anchor_1 = require("@coral-xyz/anchor");
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
const constants_1 = require("./constants");
const PumpFunProgram_1 = require("./PumpFunProgram");
const wallet_1 = require("./wallet");
const utils_1 = require("../core/utils");
class PumpeCutor {
    constructor(mint, globalPublicKey, feeRecipient, bondingCurve, associatedBondingCurve, wallet) {
        this.mint = mint;
        this.globalPublicKey = globalPublicKey;
        this.feeRecipient = feeRecipient;
        this.bondingCurve = bondingCurve;
        this.associatedBondingCurve = associatedBondingCurve;
        this.wallet = wallet;
        this.createBuyTransaction = (tokenAmountOut, solAmountIn) => __awaiter(this, void 0, void 0, function* () {
            console.log(' Creating Token Buy Transaction for ' + this.wallet.publicKey.toBase58());
            const associatedAddress = yield (0, spl_token_1.getAssociatedTokenAddress)(this.mint, this.wallet.publicKey, true);
            const buyTnx  = [];

            const keys = [
                { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
                { pubkey: associatedAddress, isSigner: false, isWritable: true },
                { pubkey: this.wallet.publicKey, isSigner: false, isWritable: false },
                { pubkey: this.mint, isSigner: false, isWritable: false },
                { pubkey: web3_js_1.SystemProgram.programId, "isSigner": false, "isWritable": false },
                { pubkey: spl_token_1.TOKEN_PROGRAM_ID, "isSigner": false, "isWritable": false },
            ];
            const ataInst = spl_token_1.createAssociatedTokenAccountInstruction(
                this.wallet.publicKey,
                associatedAddress,
                this.wallet.publicKey,
                this.mint,
            )
            console.log("****************** ");
            const buytnx = yield this.pfProgram.methods.buy(tokenAmountOut, solAmountIn).accounts({
                global: this.globalPublicKey,
                feeRecipient: this.feeRecipient,
                mint: this.mint,
                bondingCurve: this.bondingCurve,
                associatedBondingCurve: this.associatedBondingCurve,
                associatedUser: associatedAddress,
            }).instruction();
           
            buyTnx.push(ataInst);
            buyTnx.push(buytnx);
            return buyTnx;

        });
        this.createSellTransaction = () => __awaiter(this, void 0, void 0, function* () {
            console.log(' Creating Token Sell Transaction for ' + this.wallet.publicKey.toBase58());
            const tokenAccnt = yield (0, utils_1.getWalletTokenAccount)(constants_1.connection, this.wallet.publicKey, this.mint);
            let tokenBal = 0;
            const tx = new web3_js_1.Transaction();
            const userAta = (0, spl_token_1.getAssociatedTokenAddressSync)(this.mint, this.wallet.publicKey, true, spl_token_1.TOKEN_PROGRAM_ID);
            if (tokenAccnt.length > 1) {
                const tokenBalance = Number(tokenAccnt[0].accountInfo.amount.toNumber().toFixed(0));
                tokenBal = tokenBalance;
                let trade = '';
                if (tokenBal > 1) {
                    trade += ' Sell for wallet ' + this.wallet.publicKey.toBase58();
                    const snipeIx = yield this.pfProgram.methods.sell(new anchor_1.BN(tokenBalance - 1), new anchor_1.BN(1)).accounts({
                        global: this.globalPublicKey,
                        feeRecipient: this.feeRecipient,
                        mint: this.mint,
                        bondingCurve: this.bondingCurve,
                        associatedBondingCurve: this.associatedBondingCurve,
                        associatedUser: userAta,
                        user: this.wallet.publicKey,
                        systemProgram: web3_js_1.SystemProgram.programId,
                        tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
                        eventAuthority: constants_1.EVENT_AUTH,
                        program: this.programID,
                    }).instruction();
                    tx.add(snipeIx);
                    const SEND_AMT = constants_1.priorityFee * web3_js_1.LAMPORTS_PER_SOL;
                    const PRIORITY_FEE_IX = web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: SEND_AMT });
                    tx.add(PRIORITY_FEE_IX);
                }
            }
            return tx;
        });
        this.programID = new web3_js_1.PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
        this.provider = new anchor_1.AnchorProvider(constants_1.connection, new wallet_1.CustomWallet(wallet), anchor_1.AnchorProvider.defaultOptions());
        this.pfProgram = (0, PumpFunProgram_1.pumpFunProgram)({
            provider: this.provider,
            programId: this.programID,
        });
    }
}
module.exports = PumpeCutor;
