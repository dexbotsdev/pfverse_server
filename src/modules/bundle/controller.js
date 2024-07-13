/* eslint-disable no-undef */
const express = require("express");
const { getQuery } = require("./service.js");
const { save, update, getById, dynamicSearch ,searchOne} = require("../../core/repository.js");
const anchor = require('@coral-xyz/anchor');
const {PublicKey,Keypair} = require('@solana/web3.js')
const {getAssociatedTokenAddressSync} = require('@solana/spl-token')
const bs58 = require('bs58');
const cron = require("node-cron")
const LaunchBundler = require("./")
const {programID}= require('../../common/constants.js')
const { METADATA_PROGRAM_ID }=require('@raydium-io/raydium-sdk')
const { ObjectId } = require("mongoose").Types;

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
const PumpBundler = require("./PumpBundler.js");
 
function createCronExpressionFromDate(date) {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${minute} ${hour} ${dayOfMonth} ${month} *`;
}

const router = express.Router();

const searchHandler = async (req, res, next) => {
  req.searchQuery = getQuery(req.body);
  return baseSearchHandler(req, res, next);
};

const countHandler = async (req, res, next) => {
  req.searchQuery = getQuery(req.body);
  return baseCountHandler(req, res, next);
};
 
const sellAllTokenWallets = async (req, res, next) => {
  try {
     let preMeta = req.body.sellMeta;
     const mint = preMeta.mint;
    
     return res.status(201).send(savedDoc);
  } catch (error) {
    return next(error, req, res);
  }
};

const createBundleSchedule = async (req, res, next) => {
  try {
    let preMeta = req.body.schedule

    const mint = preMeta.mint;
    const jitoFeesTxt = preMeta.jitoFees;
    let jitoFees = 0.0001

    if(jitoFeesTxt.indexOf('Medium')!=-1){
      jitoFees=0.001
    } else 
    if(jitoFeesTxt.indexOf('High')!=-1){
      jitoFees=0.02;
    }
    const runtime = new Date(preMeta.schedule);
    console.log(mint)
    console.log(runtime);
    const query = {mint:mint,createdBy: ObjectId(req.user.id)}

    let tokenMeta = await searchOne(query,'TokenMeta');
    const walletsMeta = await dynamicSearch(query ,'WalletsMeta');
    const jobMeta = await searchOne(query,'JobMeta');

    if(!tokenMeta ){
      return res.status(500).send({ error: true, message: 'No Such Token', tokenMeta: null, wallets: null });
    }

    // if(jobMeta && jobMeta.bundlerStatus != 'FAILED'){
    //   return res.status(500).send({ error: true, message: 'Duplicate schedule', tokenMeta: null, wallets: null });

    // }


    let jobMetaDoc = {
      
      mint: mint,
      schedule: runtime,
      bundlerStatus: 'SCHEDULED',
      createdBy: ObjectId(req.user.id)
    }
  

    console.log(jobMetaDoc);
    const savedDoc = await save(jobMetaDoc, 'JobMeta');
    
    if(savedDoc){
      const updateData = { ...tokenMeta, bundleStatus: 'SCHEDULED' };
    const updatedRecord = await update(updateData, 'TokenMeta');
    tokenMeta = await searchOne(query, 'TokenMeta');

    let schedulerToken = await searchOne(query, 'TokenMeta');
    let schedulerWallets = await dynamicSearch(query ,'WalletsMeta');
     scheduleNewBundle(req.user.id,schedulerToken,schedulerWallets,jitoFees,runtime)

      console.log('SCHEDULED BUNDLE ')

      const pfk = Keypair.fromSecretKey(bs58.decode(tokenMeta.fundingwallet))
      const pdk = Keypair.fromSecretKey(bs58.decode(tokenMeta.devwallet))
  
      tokenMeta.fundingwallet = pfk.publicKey.toBase58();
      tokenMeta.devwallet = pdk.publicKey.toBase58();
      tokenMeta.mintKey = '';
  
  
    return res.status(201).send({ error: false, message: '', tokenMeta: tokenMeta, wallets: null });
    }
    else return res.status(500).send({ error: true, message: '', tokenMeta: null, wallets: null });
  } catch (error) {
    return next(error, req, res);
  }
};

 
router.post("/sellAllTokenWallets",  sellAllTokenWallets);
router.post("/createBundleSchedule",  createBundleSchedule);
router.put("/update", handleValidation(validate), updateHandler);
router.post("/search", searchHandler);
router.post("/count", countHandler);
router.delete("/delete", deleteHandler);

module.exports = router;



function scheduleNewBundle(id,tokenMeta,walletsMeta,jitoFees,schedule) {
  const cronTime = createCronExpressionFromDate(schedule);

  console.log('SCHEDULED BUNDLE ',cronTime)

  cron.schedule(cronTime, async () => {
      console.log('Scheduled Job Running Now ' + tokenMeta)
      try{
        const pmp = new PumpBundler();
          await pmp.createBundle(tokenMeta,walletsMeta,jitoFees);
      }catch(err){
          console.log(err)
      }
      
      
  });
}