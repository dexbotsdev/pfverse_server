/* eslint-disable no-undef */
const express = require("express");
const { getQuery } = require("./service");
const { save, update, getById, search ,searchOne} = require("../../core/repository");
const anchor = require('@coral-xyz/anchor');
const {PublicKey,Keypair} = require('@solana/web3.js')
const {getAssociatedTokenAddressSync} = require('@solana/spl-token')
const bs58 = require('bs58');
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
} = require("../../core/controller");
const { validate } = require("./request");
const { handleValidation } = require("../../common/middlewares");

const router = express.Router();

const searchHandler = async (req, res, next) => {
  req.searchQuery = getQuery(req.body);
  return baseSearchHandler(req, res, next);
};

const countHandler = async (req, res, next) => {
  req.searchQuery = getQuery(req.body);
  return baseCountHandler(req, res, next);
};

const getTokenMeta = async (req, res, next) => {
  try {
    const mint = req.query.mint;
   
     console.log('Searching for Tokenmeta with given req.user ', req.user);
    const query = {mint:mint,createdBy: ObjectId(req.user.id)}

    const savedDoc = await searchOne(query, 'TokenMeta');
    
    const pfk = Keypair.fromSecretKey(bs58.decode(savedDoc.fundingwallet))
    const pdk = Keypair.fromSecretKey(bs58.decode(savedDoc.devwallet))
 
    savedDoc.fundingwallet=pfk.publicKey.toBase58();
    savedDoc.devwallet=pdk.publicKey.toBase58();
    savedDoc.mintKey='';


    return res.status(201).send(savedDoc);
  } catch (error) {
    return next(error, req, res);
  }
};

const getMyBundles = async (req, res, next) => {
  try {
  
     console.log('Searching for bundles with given req.user ', req.user);
    const query = {createdBy: ObjectId(req.user.id)}

    const savedDoc = await search({}, query, 'TokenMeta');
    
    savedDoc.forEach((item)=>{
      item.fundingwallet="";
      item.devwallet="";
      item.mintKey="";
    })

    return res.status(201).send(savedDoc);
  } catch (error) {
    return next(error, req, res);
  }
};


const postHandler = async (req, res, next) => {
  try {
    let preMeta = req.body.tokenMeta 

    const query = {metadataUrl:preMeta.metadataUrl,createdBy: ObjectId(req.user.id)}

    const dataOld = await searchOne(query,'TokenMeta');

    if(dataOld){
      return res.status(500).error('Already Exists');
    }

    const pfk = Keypair.generate();
    const pdk = Keypair.generate();
    const fwallet = bs58.encode(pfk.secretKey);
    const dwallet = bs58.encode(pdk.secretKey);
    const tokenMint = Keypair.generate();
    const creatorWallet = preMeta.publicKey;
  
    let [bondingCurve] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("bonding-curve"), tokenMint.publicKey.toBuffer()], programID);
    let associatedBondingCurve = getAssociatedTokenAddressSync(tokenMint.publicKey, bondingCurve, true);
    let [metadata] = PublicKey.findProgramAddressSync([anchor.utils.bytes.utf8.encode("metadata"), METADATA_PROGRAM_ID.toBuffer(), tokenMint.publicKey.toBuffer()], METADATA_PROGRAM_ID)
  


    let tokenMetaDoc = {
      ...preMeta,
      fundingwallet: fwallet,
      devwallet: dwallet,
      mintKey: bs58.encode(tokenMint.secretKey),
      mint: tokenMint.publicKey.toBase58(),
      bondingCurve: bondingCurve.toBase58(),
      associatedBondingCurve: associatedBondingCurve.toBase58(),
      metadata: metadata.toBase58(),
      creatorwallet: creatorWallet,
      createdBy: ObjectId(req.user.id)
    }
  
    console.log(tokenMetaDoc);
    const savedDoc = await save(tokenMetaDoc, 'TokenMeta');
    
    savedDoc.fundingwallet=pfk.publicKey.toBase58();
    savedDoc.devwallet=pdk.publicKey.toBase58();
    savedDoc.mintKey='';
 
    return res.status(201).send(savedDoc);
  } catch (error) {
    return next(error, req, res);
  }
};


router.get("/getMyBundles", getMyBundles);
router.get("/getTokenMeta", getTokenMeta);
router.post("/createTokenMeta",  postHandler);
router.put("/update", handleValidation(validate), updateHandler);
router.post("/search", searchHandler);
router.post("/count", countHandler);
router.delete("/delete", deleteHandler);

module.exports = router;
