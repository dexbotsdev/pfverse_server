const { AnchorProvider, BN } = require("@coral-xyz/anchor");
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } = require("@solana/spl-token");
const { PublicKey, Keypair, TransactionInstruction, LAMPORTS_PER_SOL, ComputeBudgetProgram, VersionedTransaction, TransactionMessage, Transaction, SystemProgram } = require("@solana/web3.js");
const { connection, FEERCPT, perKToken,priorityFees, programID,   GLOBALSTATE, EVENT_AUTH, getRandomTipAccount } = require('../../common/constants');
const { pumpFunProgram } = require("../../common/PumpFunProgram.js");
const { CustomWallet } = require("../../common/wallet.js");
const anchor = require("@coral-xyz/anchor");
const { bs58 } = require("@coral-xyz/anchor/dist/cjs/utils/bytes");
const { chunkArray, METADATA_PROGRAM_ID } = require("@raydium-io/raydium-sdk");
const PumpeCutor = require("../../common/Pumpecutor.js");
const JitoExecutor = require("../../common/JitoExecutor.js"); 
 const axios = require("axios");
 const { save, update, getById, dynamicSearch ,searchOne} = require("../../core/repository.js");


class PumpBundler {

    constructor() {
        this.programID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
    }

    createBundle = async (tokenMeta,walletsMeta, jitoTips) => {
        console.log('Creating Bundle Transaction for ' + tokenMeta.mint); 

         const tokenKey = tokenMeta.mintKey;
        const walletKey = tokenMeta.devwallet;
        const tokenMint = Keypair.fromSecretKey(bs58.decode(tokenKey));
        const privateKey = Keypair.fromSecretKey(bs58.decode(walletKey));

        this.provider = new AnchorProvider(
            connection,
            new CustomWallet(privateKey),
            AnchorProvider.defaultOptions()
        );
        this.pfProgram = pumpFunProgram({
            provider: this.provider,
            programId: this.programID,
        });

        const tokenName = tokenMeta.name;
        const symbol = tokenMeta.symbol;
        const metadataUrl = tokenMeta.metadataUrl;

        const feeRecipient = FEERCPT;
        const [globalPublicKey] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("global")], programID);
        let [mintAuthority] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("mint-authority")], programID);
        let [bondingCurve] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("bonding-curve"), tokenMint.publicKey.toBuffer()], programID);
        let associatedBondingCurve = getAssociatedTokenAddressSync(tokenMint.publicKey, bondingCurve, true);
        let [metadata] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("metadata"), METADATA_PROGRAM_ID.toBuffer(), tokenMint.publicKey.toBuffer()], METADATA_PROGRAM_ID);
        let [eventAuthority] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("__event_authority")], programID);
        const blockhash = await connection.getLatestBlockhash('finalized');

        const launchTnx = [];

        console.log({
            mint: tokenMint.publicKey,
            mintAuthority: mintAuthority,
            bondingCurve: bondingCurve,
            associatedBondingCurve: associatedBondingCurve,
            global: globalPublicKey,
            mplTokenMetadata: METADATA_PROGRAM_ID,
            metadata: metadata,
            eventAuthority: eventAuthority
        });

        const generateLaunchTnx = async () => {
            const createInst = await this.pfProgram.methods.create(tokenName, symbol, metadataUrl)
                .accounts({
                    mint: tokenMint.publicKey,
                    mintAuthority: mintAuthority,
                    bondingCurve: bondingCurve,
                    associatedBondingCurve: associatedBondingCurve,
                    global: globalPublicKey,
                    mplTokenMetadata: METADATA_PROGRAM_ID,
                    metadata: metadata,
                    eventAuthority: eventAuthority,
                })
                .signers([tokenMint])
                .instruction();

            const userAta = getAssociatedTokenAddressSync(tokenMint.publicKey, privateKey.publicKey, true, TOKEN_PROGRAM_ID);
            const wallet = Keypair.fromSecretKey(bs58.decode(tokenMeta.devwallet));
            const balance = await connection.getBalance(wallet.publicKey);
            let trade = 'Preparing ';
            const maxSolCost = Number((balance - 0.0023908 * LAMPORTS_PER_SOL) * (0.95)).toFixed(0);
            const tradeAmount = Number(maxSolCost/perKToken).toFixed(0);
            const buytnx = await this.pfProgram.methods.buy(new BN(tradeAmount), new BN(maxSolCost)).accounts({
                global: globalPublicKey,
                feeRecipient: feeRecipient,
                mint: tokenMint.publicKey,
                bondingCurve: bondingCurve,
                associatedBondingCurve: associatedBondingCurve,
                associatedUser: userAta,
                user: privateKey.publicKey
            }).instruction();

            launchTnx.push(ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: 100000
            }));
            launchTnx.push(ComputeBudgetProgram.setComputeUnitLimit({
                units: 25e4
            }));
            launchTnx.push(createInst);

            launchTnx.push(
                createAssociatedTokenAccountInstruction(
                    privateKey.publicKey,
                    userAta,
                    privateKey.publicKey,
                    tokenMint.publicKey,
                )
            )
            launchTnx.push(buytnx);
    
            // const tipSwapIxn = SystemProgram.transfer({
            //     fromPubkey: privateKey.publicKey,
            //     toPubkey: getRandomTipAccount(),
            //     lamports: jitoTips * LAMPORTS_PER_SOL,
            // });
            // launchTnx.push(tipSwapIxn);
            return launchTnx;
        }

        const generateBundlers = async () => {
            const bundleTnx = [];

             for (let twall in walletsMeta) {
                const item = walletsMeta[twall];
                const wallet = Keypair.fromSecretKey(bs58.decode(item.secretKey));
                const balance = await connection.getBalance(wallet.publicKey);
                let trade = 'Preparing ';
                const maxSolCost = Number((balance - 0.0023908 * LAMPORTS_PER_SOL) * (0.95)).toFixed(0);
                const tradeAmount = maxSolCost/perKToken;

                const walletBal = await connection.getBalance(wallet.publicKey);
                console.log('Wallet balance is ' + walletBal.toString());
                trade += ' Buy for wallet ' + wallet.publicKey.toBase58() + ":" + tradeAmount;

                const pumper = new PumpeCutor(
                    tokenMint.publicKey,
                    globalPublicKey,
                    feeRecipient,
                    bondingCurve,
                    associatedBondingCurve,
                    wallet
                );
                const tx = await pumper.createBuyTransaction(new BN(tradeAmount), new BN(maxSolCost));
                bundleTnx.push({ wallet: wallet, transaction: tx });
                console.log(trade);
            }

            return bundleTnx;
        }


        const generateMassBundlers = async () => {
            const txsSigned = [];
            const chunkedKeypairs = chunkArray(walletsMeta, 5); // EDIT CHUNKS?
            const lookupTableAccount = (
                await connection.getAddressLookupTable(new PublicKey(tokenMeta.lookupTableAdress))
            ).value;
            console.log(' Generating Buy chunkedKeypairs '+walletsMeta.length) 
            console.log(' Generating Buy chunkedKeypairs '+chunkedKeypairs.length)
            console.log(' lookupTableAdress for chunkedKeypairs '+tokenMeta.lookupTableAdress)

            for (let chunkIndex = 0; chunkIndex < chunkedKeypairs.length; chunkIndex++) {
                const chunk = chunkedKeypairs[chunkIndex];
                const instructionsForChunk = [];
    
                for (let i = 0; i < chunk.length; i++) {
                    const item = chunk[i];
                    const wallet = Keypair.fromSecretKey(bs58.decode(item.secretKey));
                    let trade = ' Preparing '
                    const tradeAmount = Number(item.solanaSpend)*0.85 / Number(perKToken)
                    const maxSolCost = Number(item.solanaSpend)
                    const walletBal = await connection.getBalance(wallet.publicKey);
                    console.log('Wallet balance is ' + walletBal.toString())
                    trade += ' Buy for wallet ' + wallet.publicKey.toBase58() + "-" + Number(maxSolCost).toFixed(5) + ":" + Number(tradeAmount * 1e6).toFixed(0)
                    console.log(trade);
                    const pumper = new PumpeCutor(
                        tokenMint.publicKey,
                        globalPublicKey,
                        feeRecipient,
                        bondingCurve,
                        associatedBondingCurve,
                        wallet
                    )
                    const buytnxs = await pumper.createBuyTransaction(new BN(Number(tradeAmount * 1e6).toFixed(0)), new BN(walletBal));
                    instructionsForChunk.push(...buytnxs);
                }
                const wallet = Keypair.fromSecretKey(bs58.decode(chunk[0].secretKey));

                const keypair = wallet;
    
                if (chunkIndex === chunkedKeypairs.length - 1 ) {
                    const tipSwapIxn = SystemProgram.transfer({
                        fromPubkey: privateKey.publicKey,
                        toPubkey: getRandomTipAccount(),
                        lamports: jitoTips * LAMPORTS_PER_SOL,
                    });
                    instructionsForChunk.push(tipSwapIxn);
                    console.log('Jito tip added :).');
                }  
                
 
                const message = new TransactionMessage({
                    payerKey: keypair.publicKey,
                    recentBlockhash: blockhash.blockhash,
                    instructions: instructionsForChunk,
                }).compileToV0Message([lookupTableAccount]);
    
                const versionedTx = new VersionedTransaction(message);
    
        
                console.log("Signing transaction with chunk signers");
    
                // Sign with the wallet for tip on the last instruction
                if (chunkIndex === chunkedKeypairs.length - 1) {
                    versionedTx.sign([privateKey]);
                }
    
                for (const item of chunk) {
                    const wallet = Keypair.fromSecretKey(bs58.decode(item.secretKey));
                    versionedTx.sign([wallet]);
                }
    
    
                txsSigned.push(versionedTx);
            }
    
            return txsSigned;
    
        }
        const addLookupTableInfo = (await connection.getAddressLookupTable(new PublicKey(tokenMeta.lookupTableAdress))).value

        const ltnx = await generateLaunchTnx();
        const txMainSwaps= await generateMassBundlers();

        const launchInst = ltnx;
 
        const fin = new VersionedTransaction(
            new TransactionMessage(
                {
                    payerKey: privateKey.publicKey,
                    recentBlockhash: blockhash.blockhash,
                    instructions: launchInst
                }
            ).compileToV0Message([addLookupTableInfo])
        );

        fin.sign([privateKey, tokenMint]);

        const bundledTxns = [];
        bundledTxns.push(fin);
        bundledTxns.push(...txMainSwaps);
        const jito = new JitoExecutor();
        let accepted = false;

        const query = {mint:tokenMeta.mint}

         tokenMeta = await searchOne(query,'TokenMeta');
        const jobMeta = await searchOne(query,'JobMeta');

        const onAcceptedBundle = async (bundleResult, bundleId) => {
            const resbundleId = bundleResult.bundleId;

            if (resbundleId == bundleId) {
                const isAccepted = bundleResult.accepted;
                const isRejected = bundleResult.rejected;
                if (isAccepted) {
                    accepted = true;
                    console.info(
                        `Bundle ${bundleId} accepted in slot ${bundleResult?.accepted?.slot} by validator ${bundleResult?.accepted?.validatorIdentity}`,
                    );
                    console.log('Confirmation of Launch Recd');
                    const updateData = { ...tokenMeta, bundleStatus: 'SUCCESS',reason:`Bundle ${bundleId} accepted in slot ${bundleResult?.accepted?.slot} by validator ${bundleResult?.accepted?.validatorIdentity}`  };
                    const updatedRecord = await update(updateData, 'TokenMeta');
                    const updateJobData = { ...tokenMeta, bundlerStatus: 'SUCCESS',reason:`Bundle ${bundleId} accepted in slot ${bundleResult?.accepted?.slot} by validator ${bundleResult?.accepted?.validatorIdentity}` };
                    const updatedJobRecord = await update(updateJobData, 'JobMeta');
                }
                if (isRejected && !accepted) {
                    console.info(bundleResult.rejected, `Bundle ${bundleId} rejected:`);
                    const updateData = { ...tokenMeta, bundleStatus: 'FAILED',reason:bundleResult.rejected.simulationFailure.msg.message };
                    const updatedRecord = await update(updateData, 'TokenMeta');
                    const updateJobData = { ...tokenMeta, bundlerStatus: 'FAILED',reason:bundleResult.rejected.simulationFailure.msg.message };
                    const updatedJobRecord = await update(updateJobData, 'JobMeta');
                }
            }
        }

        jito.executeAndConfirmBundle(bundledTxns, [privateKey, tokenMint], blockhash, onAcceptedBundle);
    }

    sellAllSwapAndExecute = async (tokenAddress) => {
        const response = await axios.get(`https://frontend-api.pump.fun/coins/${tokenAddress}`).then(result => result.data).catch(error => null);

        const bondingCurve = response.bonding_curve;
        const globalState = GLOBALSTATE;
        const feeRecipient = FEERCPT;
        const bondingCurveAta = response.associated_bonding_curve;
        const tradeList = [];
        const tokenMeta = await TokenMeta.findOne({ mint: tokenAddress }).exec();
        const walletMeta = await WalletMeta.find({ mint: tokenAddress }).exec();

        const tokenKey = tokenMeta?.mintKey;
        const walletKey = tokenMeta?.fwallet;
        const tokenMint = Keypair.fromSecretKey(bs58.decode(tokenKey));
        const privateKey = Keypair.fromSecretKey(bs58.decode(walletKey));
        const baseMint = tokenMint.publicKey;

        for (let twall in walletMeta) {
            const item = walletMeta[twall];
            const wallet = Keypair.fromSecretKey(bs58.decode(item.secretKey));
            const tokenAccnt = await getWalletTokenAccount(connection, wallet.publicKey, baseMint);
            let tokenBal = 0;
            const provider = new AnchorProvider(
                connection,
                new CustomWallet(wallet),
                AnchorProvider.defaultOptions()
            );
            const pfProgram = pumpFunProgram({
                provider: provider,
                programId: programID,
            });

            const tx = new Transaction().add(PRIORITY_FEE_IX);
            const userAta = getAssociatedTokenAddressSync(baseMint, wallet.publicKey, true, TOKEN_PROGRAM_ID);

            if (tokenAccnt.length > 0) {
                const tokenBalance = Number(tokenAccnt[0].accountInfo.amount.toNumber().toFixed(0));
                tokenBal = tokenBalance;
                let trade = '';
                if (tokenBal > 1) {
                    trade += 'Sell for wallet ' + wallet.publicKey.toBase58();
                    const snipeIx = await pfProgram.methods.sell(
                        new BN(tokenBalance - 1),
                        new BN(1),
                    ).accounts({
                        global: globalState,
                        feeRecipient: feeRecipient,
                        mint: baseMint,
                        bondingCurve: bondingCurve,
                        associatedBondingCurve: bondingCurveAta,
                        associatedUser: userAta,
                        user: wallet.publicKey,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        eventAuthority: EVENT_AUTH,
                        program: programID,
                    }).instruction();

                    tx.add(snipeIx);
                    const { blockhash } = await connection.getLatestBlockhash();
                    tx.feePayer = wallet.publicKey;
                    tx.recentBlockhash = blockhash;
                    tx.sign(wallet);
                    tradeList.push({ transaction: tx, address: wallet.publicKey.toBase58() });
                    console.log(trade);
                }
            }
        }

        const responses = await Promise.all(
            tradeList.map(async (tnx) => {
                console.log('Running for Wallet ' + tnx.address);
                try {
                    return await sendSignedTransaction({
                        signedTransaction: tnx.transaction,
                        connection,
                        skipPreflight: false,
                        successCallback: async (txSig) => {
                            console.log('Sent Transaction Success: Signature: ' + txSig);
                        },
                        sendingCallback: async (txSig) => {
                            console.log('Sent Transaction awaiting Confirmation ' + txSig);
                        },
                        confirmStatus: async (txSig, confirmStatus) => {
                            console.log('Received Transaction Confirmation: ', txSig + ":" + confirmStatus);
                        },
                    });
                } catch (error) {
                    console.log(String(error));
                    return null;
                }
            })
        );

        return responses;
    }
}

module.exports = PumpBundler;