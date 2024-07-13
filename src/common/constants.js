
const { TxVersion,Token }=require('@raydium-io/raydium-sdk')
const {PublicKey,Keypair,Connection,clusterApiUrl} = require('@solana/web3.js')

const {TOKEN_PROGRAM_ID} = require('@solana/spl-token');
const { bs58 } = require('@coral-xyz/anchor/dist/cjs/utils/bytes');


const perKToken = 2.8e-8; 
const makeTxVersion = TxVersion.LEGACY;   
 
const DEFAULT_TOKEN = {
  'SOL': new Token(TOKEN_PROGRAM_ID, new PublicKey('So11111111111111111111111111111111111111112'), 9, 'WSOL', 'WSOL'),
  'USDC': new Token(TOKEN_PROGRAM_ID, new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 6, 'USDC', 'USDC'),
  'RAY': new Token(TOKEN_PROGRAM_ID, new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY'),
  'RAY_USDC-LP': new Token(TOKEN_PROGRAM_ID, new PublicKey('FGYXP4vBkMEtKhxrmEBcWN8VNmXX8qNgEJpENKDETZ4Y'), 6, 'RAY-USDC', 'RAY-USDC'),
} 

const programID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const MEMO_PROGRAM_ID =  new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const FEERCPT =  new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM");
const EVENT_AUTH =  new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
const GLOBALSTATE =  new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
const MPL_TOKEN_METADATA_PROGRAM_ID =  new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

exports.RPC_URL = 'https://quick-necessary-butterfly.solana-mainnet.quiknode.pro/c6a3716c69cb68142683684a4f8276b3496c57fc/';
exports.useJupiter = false;
exports.devNet = true;
exports.priorityFees = 0.001;
exports.jitoTips = 0.001;
const connection = exports.devNet ? new Connection('https://api.devnet.solana.com','finalized') : 
new Connection(exports.RPC_URL, 'finalized');
exports.SHYFT_API_KEY = 'h-kT9i6vhNnI76oY';
exports.useExecutor = 'Shyft';
const sysWallet = Keypair.fromSecretKey(bs58.decode('4kGXrZNxJEyf5tBCACsPGudT4oiT548Tq6Wfj4DmfxUDyfqmQVjXHA8PhhYA7BiVU7DwCqZkzPR4T9gn9Dn4mK8T'));
const sysShare = 1
const TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
].map((pubkey) => new PublicKey(pubkey));

const getRandomTipAccount = () => TIP_ACCOUNTS[Math.floor(Math.random() * TIP_ACCOUNTS.length)];

exports.programID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
exports.MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
exports.FEERCPT = new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM");
exports.EVENT_AUTH = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
exports.GLOBALSTATE = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
exports.MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");


module.exports = { perKToken,makeTxVersion,DEFAULT_TOKEN,sysShare,getRandomTipAccount,
    programID,MEMO_PROGRAM_ID,FEERCPT,EVENT_AUTH,GLOBALSTATE,MPL_TOKEN_METADATA_PROGRAM_ID,connection,sysWallet
};



