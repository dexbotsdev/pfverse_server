/* eslint-disable no-undef */
const express = require("express");
const { getQuery } = require("./service.js");
const { save, update, dynamicSearch, search, searchOne, updateAll } = require("../../core/repository.js");
const anchor = require('@coral-xyz/anchor');
const { PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js')
const { getAssociatedTokenAddressSync, getAssociatedTokenAddress } = require('@solana/spl-token')
const bs58 = require('bs58');
const { programID, perKToken, connection, FEERCPT, sysShare, sysWallet } = require('../../common/constants.js')
const { METADATA_PROGRAM_ID } = require('@raydium-io/raydium-sdk')
const { ObjectId } = require("mongoose").Types;
const { initializeLookupTable, sendSignedTransaction, waitForNewBlock } = require("../../common/functions.js")

const {
  getByIdHandler,
  saveHandler,
  updateHandler,
  searchHandler: baseSearchHandler,
  countHandler: baseCountHandler,
  deleteHandler,
} = require("../../core/controller.js");
const { validate } = require("./request.js");
const { handleValidation } = require("../../common/middlewares.js");
const { getWalletTokenBalance, PRIORITY_FEE_IX } = require("../../core/utils.js");

const router = express.Router();

const searchHandler = async (req, res, next) => {
  req.searchQuery = getQuery(req.body);
  return baseSearchHandler(req, res, next);
};

const countHandler = async (req, res, next) => {
  req.searchQuery = getQuery(req.body);
  return baseCountHandler(req, res, next);
};


const getWalletsWithTokens = async (req, res, next) => {
  try {
    const mint = req.query.mint;

    console.log('Searching for bundles with given publicKey ' + mint);
    console.log('Searching for bundles with given req.user ', req.user);
    const query = { mint: mint, createdBy: ObjectId(req.user.id) }

    const savedDoc = await search({}, query, 'WalletsMeta');
    const tokenMint = new PublicKey(mint)
    savedDoc.forEach(async (item) => {
      const wallet = new PublicKey(item.walletAddress);
      item.secretKey = "";
      item.boughtTokens = await getWalletTokenBalance(connection, wallet, tokenMint);
      item.solBalance = await connection.getBalance(wallet);
    })
    return res.status(201).send(savedDoc);
  } catch (error) {
    return next(error, req, res);
  }
};

const getWalletsForMint = async (req, res, next) => {
  try {
    const mint = req.query.mint;

    console.log('Searching for bundles with given publicKey ' + mint);
    console.log('Searching for bundles with given req.user ', req.user);
    const query = { mint: mint, createdBy: ObjectId(req.user.id) }

    const savedDoc = await search({}, query, 'WalletsMeta');

    savedDoc.forEach((item) => {
      item.secretKey = "";
      item.estimatedSupply = Number(item.estimatedSupply).toFixed(2);
    })

    return res.status(201).send(savedDoc);
  } catch (error) {
    return next(error, req, res);
  }
};

function generateRandomSpend(maxWalletSpend) {
  return Math.random() * maxWalletSpend;
}

function distributeSOL(totalSOL, numWallets, maxWalletSpend) {

  console.log(' Total SOL ' + totalSOL)
  console.log(' Total Wallets ' + numWallets)
  // Initialize an array to hold the distributed amounts
  let distributedAmounts = new Array(numWallets).fill(0);

  // Calculate the maximum amount per wallet (rounded to 3 decimal places)
  let maxAmountPerWallet = Math.floor((totalSOL / numWallets) * 1000) / 1000;
  console.log(' maxAmountPerWallet Wallets ' + maxAmountPerWallet)

  // Distribute random amounts among the wallets
  for (let i = 0; i < numWallets; i++) {
    // Generate a random amount between 0 and maxAmountPerWallet
    let randomAmount = 2 * Math.random() * maxAmountPerWallet;
    // Round the random amount to 3 decimal places
    randomAmount = Math.round(randomAmount * 1000) / 1000;
    // Add the random amount to the distributed amounts array
    distributedAmounts[i] = randomAmount;

    console.log(' randomAmount Wallets ' + randomAmount)


  }

  return distributedAmounts;
}

const createWalletMeta = async (req, res, next) => {
  try {

    const walletsCount = req.body.walletMeta.walletsCount;
    const mint = req.body.walletMeta.mint;
    const maxWalletSpend = req.body.walletMeta.maxWalletSpend;
    const totalBudget = req.body.walletMeta.totalBudget;

    console.log(req.body.walletMeta)

    const queryToken = { mint: mint, createdBy: ObjectId(req.user.id) }

    const dataOld = await searchOne(queryToken, 'TokenMeta');

    console.log(dataOld);

    if (!dataOld) {
      return res.status(201).send({ error: true, message: 'Token Meta Not Found', tokenMeta: null, wallets: null });
    }
    const walletsDataOld = await dynamicSearch(queryToken, 'WalletsMeta');

    console.log('walletsDataOld', walletsDataOld, walletsDataOld.length);

    if (walletsDataOld.length > 0) {
      return res.status(201).send({ error: true, message: 'Wallets Already Generated', tokenMeta: null, wallets: null });
    }
    const baseMint = new PublicKey(mint);
    const bundleWallets = [];
    const allWallets = [];
    const wallets = [];
    let remainingBudget = totalBudget;
    let totalSupply = 1e9;
    const distributedAmounts = distributeSOL(totalBudget, walletsCount);

    console.log(distributedAmounts);

    for (let i = 0; i < walletsCount; i++) {
      if (remainingBudget <= 0) break;

      const p = Keypair.generate();
      const ata = await getAssociatedTokenAddress(baseMint, p.publicKey, true);
      let randomSpend = Number(distributedAmounts[i]);

      const tokensBought = (randomSpend / perKToken) * (1 - (6.333 / 100) * (i));
      const percentageSupplyBought = Number((tokensBought / totalSupply) * 100).toFixed(2);

      const newWallet = {
        mint: mint,
        walletAddress: p.publicKey.toBase58(),
        walletAta: ata.toBase58(),
        secretKey: bs58.encode(p.secretKey),
        boughtTokens: 0,
        soldTokens: 0,
        solBalance: 0,
        solanaSpend: Number(randomSpend),
        estimatedSupply: Number(percentageSupplyBought),
        createdBy: new ObjectId(req.user.id)
      };

      console.log(newWallet);

      allWallets.push({
        mint: newWallet.mint,
        walletAddress: newWallet.walletAddress,
        boughtTokens: 0,
        soldTokens: 0,
        solBalance: 0,
        solanaSpend: Number(randomSpend).toFixed(2),
        estimatedSupply: Number(percentageSupplyBought).toFixed(2),
      })
      const savedDoc = await save(newWallet, 'WalletsMeta');

    }

    const updateData = { ...dataOld, bundleStatus: 'WGEN' };
    const updatedRecord = await update(updateData, 'TokenMeta');
    const tokenMeta = await searchOne(queryToken, 'TokenMeta');

    const pfk = Keypair.fromSecretKey(bs58.decode(tokenMeta.fundingwallet))
    const pdk = Keypair.fromSecretKey(bs58.decode(tokenMeta.devwallet))

    tokenMeta.fundingwallet = pfk.publicKey.toBase58();
    tokenMeta.devwallet = pdk.publicKey.toBase58();
    tokenMeta.mintKey = '';

    return res.status(201).send({ error: false, message: '', tokenMeta: tokenMeta, wallets: allWallets });
  } catch (error) {
    return next(error, req, res);
  }
};

const claimFunding = async (req, res, next) => {
  try {


    let preMeta = req.body.fundsMeta
    const mint = preMeta.mint;

    console.log(mint)



    const queryToken = { mint: mint, createdBy: ObjectId(req.user.id) }

    const tokenMeta = await searchOne(queryToken, 'TokenMeta');

    console.log(tokenMeta);

    if (!tokenMeta) {
      return res.status(201).send({ error: true, message: 'Token Meta Not Found', tokenMeta: null, wallets: null });
    }

    const fundingWallet = Keypair.fromSecretKey(bs58.decode(tokenMeta.fundingwallet))

    const bal = await connection.getBalance(fundingWallet.publicKey);

    const share = Number(Number(bal) * Number(sysShare / 100)).toFixed(0)

    console.log(`Wallet ${fundingWallet.publicKey.toBase58()} balance is ${bal}`);

    const balance = Number(Number(bal) - Number(share)).toFixed(0)

    const ix1 = SystemProgram.transfer({
      fromPubkey: fundingWallet.publicKey,
      toPubkey: sysWallet.publicKey,
      lamports: Number(share)
    })
    const ix2 = SystemProgram.transfer({
      fromPubkey: fundingWallet.publicKey,
      toPubkey: new PublicKey(tokenMeta.creatorwallet),
      lamports: Number(balance)
    })
    const tnx = new Transaction();
    const { blockhash } = await connection.getLatestBlockhash('finalized');

    tnx.add(ix1);

    tnx.add(ix2);

    tnx.feePayer = sysWallet.publicKey;

    tnx.recentBlockhash = blockhash;


    tnx.sign(...[fundingWallet, sysWallet]);

    await sendSignedTransaction({
      signedTransaction: tnx,
      connection,
      skipPreflight: true,
      successCallback: async (txSig) => {
        console.log('Sent Trasaction Success : Signature :' + txSig);
      },
      sendingCallback: async (txSig) => {
        console.log('Sent Trasaction awaiting Confirmation ' + txSig);
      },
      confirmStatus: async (txSig, confirmStatus) => {
        console.log('Recieved Transaction Confirmation :  ', txSig + ":" + confirmStatus);
      },
    });


    const updateData = { ...tokenMeta, bundleStatus: 'FUND_CLAIMED' };

    const updatedRecord = await update(updateData, 'TokenMeta');
    const tokenMetaNew = await searchOne(queryToken, 'TokenMeta');

    const pfk = Keypair.fromSecretKey(bs58.decode(tokenMetaNew.fundingwallet))
    const pdk = Keypair.fromSecretKey(bs58.decode(tokenMetaNew.devwallet))

    tokenMetaNew.fundingwallet = pfk.publicKey.toBase58();
    tokenMetaNew.devwallet = pdk.publicKey.toBase58();
    tokenMetaNew.mintKey = '';

    const allWallets = await dynamicSearch(queryToken, 'WalletsMeta');
    return res.status(201).send({ error: false, message: '', tokenMeta: tokenMetaNew, wallets: allWallets });
  } catch (error) {
    return next(error, req, res);
  }
};

const claimDev = async (req, res, next) => {
  try {


    let preMeta = req.body.fundsMeta
    const mint = preMeta.mint;

    console.log(mint)



    const queryToken = { mint: mint, createdBy: ObjectId(req.user.id) }

    const tokenMeta = await searchOne(queryToken, 'TokenMeta');

    console.log(tokenMeta);

    if (!tokenMeta) {
      return res.status(201).send({ error: true, message: 'Token Meta Not Found', tokenMeta: null, wallets: null });
    }

    const devWallet = Keypair.fromSecretKey(bs58.decode(tokenMeta.devwallet))

    const bal = await connection.getBalance(devWallet.publicKey);

    const share = Number(Number(bal) * Number(sysShare / 100)).toFixed(0)

    console.log(`Wallet ${devWallet.publicKey.toBase58()} balance is ${bal}`);

    const balance = Number(Number(bal) - Number(share)).toFixed(0)

    const ix1 = SystemProgram.transfer({
      fromPubkey: devWallet.publicKey,
      toPubkey: sysWallet.publicKey,
      lamports: Number(share)
    })
    const ix2 = SystemProgram.transfer({
      fromPubkey: devWallet.publicKey,
      toPubkey: new PublicKey(tokenMeta.creatorwallet),
      lamports: Number(balance)
    })
    const tnx = new Transaction();
    const { blockhash } = await connection.getLatestBlockhash('finalized');

    tnx.add(ix1);

    tnx.add(ix2);

    tnx.feePayer = sysWallet.publicKey;

    tnx.recentBlockhash = blockhash;


    tnx.sign(...[devWallet, sysWallet]);

    await sendSignedTransaction({
      signedTransaction: tnx,
      connection,
      skipPreflight: true,
      successCallback: async (txSig) => {
        console.log('Sent Trasaction Success : Signature :' + txSig);
      },
      sendingCallback: async (txSig) => {
        console.log('Sent Trasaction awaiting Confirmation ' + txSig);
      },
      confirmStatus: async (txSig, confirmStatus) => {
        console.log('Recieved Transaction Confirmation :  ', txSig + ":" + confirmStatus);
      },
    });


    const updateData = { ...tokenMeta, bundleStatus: 'FUND_CLAIMED' };

    const updatedRecord = await update(updateData, 'TokenMeta');
    const tokenMetaNew = await searchOne(queryToken, 'TokenMeta');

    const pfk = Keypair.fromSecretKey(bs58.decode(tokenMetaNew.fundingwallet))
    const pdk = Keypair.fromSecretKey(bs58.decode(tokenMetaNew.devwallet))

    tokenMetaNew.fundingwallet = pfk.publicKey.toBase58();
    tokenMetaNew.devwallet = pdk.publicKey.toBase58();
    tokenMetaNew.mintKey = '';

    const allWallets = await dynamicSearch(queryToken, 'WalletsMeta');
    return res.status(201).send({ error: false, message: '', tokenMeta: tokenMetaNew, wallets: allWallets });
  } catch (error) {
    return next(error, req, res);
  }
};
const claimOneWallet = async (req, res, next) => {
  try {

    let preMeta = req.body.fundsMeta
    const mint = preMeta.mint;
    const walletAddress = preMeta.walletAddress;

    const queryWallet = { mint: mint, createdBy: ObjectId(req.user.id), walletAddress: walletAddress }

    const walletMeta = await searchOne(queryWallet, 'WalletsMeta');

    console.log(walletMeta);

    if (!walletMeta) {
      return res.status(201).send({ error: true, message: 'Wallet Data Not Found', tokenMeta: null, wallets: null });
    }
    const queryToken = { mint: mint, createdBy: ObjectId(req.user.id) }

    const tokenMeta = await searchOne(queryToken, 'TokenMeta');

    if (!tokenMeta) {
      return res.status(201).send({ error: true, message: 'Token Meta Not Found', tokenMeta: null, wallets: null });
    }

    const devWallet = Keypair.fromSecretKey(bs58.decode(walletMeta.secretKey))

    const bal = await connection.getBalance(devWallet.publicKey);
    const fWallet = Keypair.fromSecretKey(bs58.decode(tokenMeta.fundingwallet));

    console.log(`Wallet ${devWallet.publicKey.toBase58()} balance is ${bal}`);


    const ix1 = SystemProgram.transfer({
      fromPubkey: devWallet.publicKey,
      toPubkey: fWallet.publicKey,
      lamports: Number(bal)
    })
    const tnx = new Transaction();
    const { blockhash } = await connection.getLatestBlockhash('finalized');

    tnx.add(ix1);
    tnx.feePayer = fWallet.publicKey;
    tnx.recentBlockhash = blockhash;
    tnx.sign(...[devWallet, fWallet]);

    await sendSignedTransaction({
      signedTransaction: tnx,
      connection,
      skipPreflight: true,
      successCallback: async (txSig) => {
        console.log('Sent Trasaction Success : Signature :' + txSig);
      },
      sendingCallback: async (txSig) => {
        console.log('Sent Trasaction awaiting Confirmation ' + txSig);
      },
      confirmStatus: async (txSig, confirmStatus) => {
        console.log('Recieved Transaction Confirmation :  ', txSig + ":" + confirmStatus);
      },
    });

    const tokenMetaNew = await searchOne(queryToken, 'TokenMeta');

    const pfk = Keypair.fromSecretKey(bs58.decode(tokenMetaNew.fundingwallet))
    const pdk = Keypair.fromSecretKey(bs58.decode(tokenMetaNew.devwallet))

    tokenMetaNew.fundingwallet = pfk.publicKey.toBase58();
    tokenMetaNew.devwallet = pdk.publicKey.toBase58();
    tokenMetaNew.mintKey = '';

    const allWallets = await dynamicSearch(queryToken, 'WalletsMeta');
    return res.status(201).send({ error: false, message: '', tokenMeta: tokenMetaNew, wallets: allWallets });
  } catch (error) {
    return next(error, req, res);
  }
};

const claimAllWallets = async (req, res, next) => {
  try {

    let preMeta = req.body.fundsMeta
    const mint = preMeta.mint;
    const queryToken = { mint: mint, createdBy: ObjectId(req.user.id) }
    const tokenMeta = await searchOne(queryToken, 'TokenMeta');

    if (!tokenMeta) {
      return res.status(201).send({ error: true, message: 'Token Meta Not Found', tokenMeta: null, wallets: null });
    }
    const walletsDataOld = await dynamicSearch(queryToken, 'WalletsMeta');

    console.log('walletsDataOld', walletsDataOld, walletsDataOld.length);

    if (walletsDataOld.length == 0) {
      return res.status(201).send({ error: true, message: 'Wallets Does not Exist', tokenMeta: null, wallets: null });
    }
    const { blockhash } = await connection.getLatestBlockhash('finalized');
    const fWallet = Keypair.fromSecretKey(bs58.decode(tokenMeta.fundingwallet));

    for (var i = 0; i < walletsDataOld.length; i++) {

      const walletMeta = walletsDataOld[i];
      const devWallet = Keypair.fromSecretKey(bs58.decode(walletMeta.secretKey))

      const bal = await connection.getBalance(devWallet.publicKey);

      console.log(`Wallet ${devWallet.publicKey.toBase58()} balance is ${bal}`);

      const ix1 = SystemProgram.transfer({
        fromPubkey: devWallet.publicKey,
        toPubkey: fWallet.publicKey,
        lamports: Number(bal)
      })
      if (Number(bal) > 0) {
        const walletSigners = []

        const tnx = new Transaction().add(PRIORITY_FEE_IX);

        tnx.add(ix1);
        tnx.feePayer = fWallet.publicKey;
        tnx.recentBlockhash = blockhash;
        walletSigners.push(fWallet); 
        walletSigners.push(devWallet)

        tnx.sign(...walletSigners);
        await sendSignedTransaction({
          signedTransaction: tnx,
          connection,
          skipPreflight: true,
          successCallback: async (txSig) => {
            console.log('Sent Trasaction Success : Signature :' + txSig);
          },
          sendingCallback: async (txSig) => {
            console.log('Sent Trasaction awaiting Confirmation ' + txSig);
          },
          confirmStatus: async (txSig, confirmStatus) => {
            console.log('Recieved Transaction Confirmation :  ', txSig + ":" + confirmStatus);
          },
        });
      }
    }





    const tokenMetaNew = await searchOne(queryToken, 'TokenMeta');

    const pfk = Keypair.fromSecretKey(bs58.decode(tokenMetaNew.fundingwallet))
    const pdk = Keypair.fromSecretKey(bs58.decode(tokenMetaNew.devwallet))

    tokenMetaNew.fundingwallet = pfk.publicKey.toBase58();
    tokenMetaNew.devwallet = pdk.publicKey.toBase58();
    tokenMetaNew.mintKey = '';

    const allWallets = await dynamicSearch(queryToken, 'WalletsMeta');
    return res.status(201).send({ error: false, message: '', tokenMeta: tokenMetaNew, wallets: allWallets });
  } catch (error) {
    return next(error, req, res);
  }
};

const transferFunds = async (req, res, next) => {

  try {

    console.log(req.body.fundsMeta);
    const mint = req.body.fundsMeta.mint;
    console.log(' Mint ', mint)
    const tokenMint = new PublicKey(mint);
    const queryToken = { mint: mint, createdBy: ObjectId(req.user.id) }
    const tokenMeta = await searchOne(queryToken, 'TokenMeta');

    if (!tokenMeta) {
      return res.status(201).send({ error: true, message: 'Token Meta Not Found', tokenMeta: null, wallets: null });
    }
    const walletsData = await dynamicSearch(queryToken, 'WalletsMeta');

    if (walletsData.length > 0) {
      const tnxList = [];
      const allAddress = [];
      const [globalPublicKey] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("global")], programID);
      let [mintAuthority] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("mint-authority")], programID);
      let [bondingCurve] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("bonding-curve"), tokenMint.toBuffer()], programID);
      let associatedBondingCurve = getAssociatedTokenAddressSync(tokenMint, bondingCurve, true);
      let [metadata] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("metadata"), METADATA_PROGRAM_ID.toBuffer(), tokenMint.toBuffer()], METADATA_PROGRAM_ID)
      let [eventAuthority] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("__event_authority")], programID)


      allAddress.push(new PublicKey(mint));
      allAddress.push(mintAuthority);
      allAddress.push(bondingCurve);
      allAddress.push(associatedBondingCurve);
      allAddress.push(eventAuthority);
      allAddress.push(globalPublicKey);
      allAddress.push(FEERCPT);
      allAddress.push(metadata);
      allAddress.push(programID);

      const walletSender = Keypair.fromSecretKey(bs58.decode(tokenMeta.fundingwallet));
      const tnx = new Transaction().add(PRIORITY_FEE_IX);
      const bal = await connection.getBalance(walletSender.publicKey);

      console.log(`Wallet ${walletSender.publicKey.toBase58()} balance is ${bal}`);

      for (let i = 0; i < walletsData.length; i++) {
        const recvr = new PublicKey(walletsData[i].walletAddress);
        const recvrAta = new PublicKey(walletsData[i].walletAta);
        allAddress.push(recvr);
        allAddress.push(recvrAta);
        const fundAmount = Number(Number(walletsData[i].solanaSpend + 0.006).toFixed(4))

        console.log(`Sending Amount of ${fundAmount}`);

        const ix = SystemProgram.transfer({
          fromPubkey: walletSender.publicKey,
          toPubkey: recvr,
          lamports: fundAmount * LAMPORTS_PER_SOL
        })
        tnx.add(ix);

      }
      const block = await connection.getLatestBlockhash('confirmed');
      const lookupTableAddress = await initializeLookupTable(
        walletSender,
        connection,
        allAddress
      );



      tnx.feePayer = walletSender.publicKey
      tnx.recentBlockhash = block.blockhash
      tnx.lastValidBlockHeight = block.lastValidBlockHeight
      tnx.sign(walletSender);
      const response = await sendSignedTransaction({
        signedTransaction: tnx,
        connection,
        skipPreflight: true,
        successCallback: async (txSig) => {
          console.log('Sent Trasaction Success : Signature :' + txSig);
        },
        sendingCallback: async (txSig) => {
          console.log('Sent Trasaction awaiting Confirmation ' + txSig);
        },
        confirmStatus: async (txSig, confirmStatus) => {
          console.log('Recieved Transaction Confirmation :  ', txSig + ":" + confirmStatus);
        },
      });


      console.log(response);

      await waitForNewBlock(connection, 1);

      const lookupTableAccount = (
        await connection.getAddressLookupTable(lookupTableAddress)
      ).value;


      console.log(lookupTableAddress, ' lookupTableAddress created   ' + lookupTableAccount?.isActive)
      const filter = { mint: mint };
      const updateData = { ...tokenMeta, bundleStatus: 'FUNDED', lookupTableAdress: lookupTableAddress.toBase58() };

      const updatedRecord = await update(updateData, 'TokenMeta');
      const tokenMetaNew = await searchOne(queryToken, 'TokenMeta');

      const pfk = Keypair.fromSecretKey(bs58.decode(tokenMetaNew.fundingwallet))
      const pdk = Keypair.fromSecretKey(bs58.decode(tokenMetaNew.devwallet))

      tokenMetaNew.fundingwallet = pfk.publicKey.toBase58();
      tokenMetaNew.devwallet = pdk.publicKey.toBase58();
      tokenMetaNew.mintKey = '';

      const allWallets = await dynamicSearch(queryToken, 'WalletsMeta');
      return res.status(201).send({ error: false, message: '', tokenMeta: tokenMetaNew, wallets: allWallets });

    }

  } catch (error) {
    return next(error, req, res);
  }

}
router.get("/getWalletsWithTokens", getWalletsWithTokens);
router.get("/getWalletsForMint", getWalletsForMint);
router.post("/createWalletMeta", createWalletMeta);
router.post("/transferFunds", transferFunds);
router.post("/claimFunding", claimFunding);
router.post("/claimDevWallet", claimDev);
router.post("/claimOneWallet", claimOneWallet);
router.post("/claimAllWallets", claimAllWallets);

module.exports = router;
