
import fs from 'mz/fs';
import sleep from './util/sleep';
import sendAndConfirmTransaction from './util/send-and-confirm-transaction';
import {url, urlTls} from './util/url';
import {byteArrayToString, stringToByteArray, byteArrayToLong, longToByteArray} from './util/helpers';
import dotenv from 'dotenv';
import {mnemonicToSeed, getAccountFromSeed} from './util/wallet';
import BigNumber from 'bignumber.js'

import {
  Account,
  Connection,
  BpfLoader,
  BPF_LOADER_PROGRAM_ID,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY
} from '@solana/web3.js';

import { Token, MintLayout, AccountLayout } from "@solana/spl-token";
import { Market } from '@project-serum/serum';

let TREASURY_TOKEN_PRECISION = 9;
let TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

/**
 * Connection to the network
 */
let connection;

/**
 * Program id
 */
let programId;
let ammProgramId;

/**
 * Pool ratio (coin/pc)
 */
let coinPcRatio;

/**
 * Compound account to send txs
 */
let compoundAccount;
let compoundTokenAccount;
let compoundTokenPubkey;

/**
 * Establish a connection to the cluster
 */
export async function establishConnection() {
  connection = new Connection(url, 'recent');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', url, version);
}

async function setCompoundAccount() {
    let mnemonic = process.env.COMPOUND_ACCOUNT_SEED != undefined ?
           process.env.COMPOUND_ACCOUNT_SEED :
           "";
    let derivationPath = process.env.DERIVATION_PATH != undefined ?
          process.env.DERIVATION_PATH :
          "bip44Change";
    let seed = await mnemonicToSeed(mnemonic);
    compoundAccount = getAccountFromSeed(Buffer.from(seed, 'hex'), 0, derivationPath);

    console.log("Using account", compoundAccount.publicKey.toBase58());
}

export async function harvest() {
    return await deposit(0);
}

export async function deposit(amount) {

    let tokenAcc = (process.env.USER_RAY_TOKEN_ACCOUNT) ? new PublicKey(process.env.USER_RAY_TOKEN_ACCOUNT) :
                    new PublicKey(process.env.USER_PC_TOKEN_ACCOUNT);

    const instruction = new TransactionInstruction({
        keys: [
                { pubkey: new PublicKey(process.env.POOL_ID), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.POOL_AUTHORITY), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.USER_INFO_ACCOUNT), isSigner: false, isWritable: true },
                { pubkey: compoundAccount.publicKey, isSigner: true, isWritable: true },
                { pubkey: new PublicKey(process.env.USER_LP_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.POOL_LP_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
                { pubkey: tokenAcc, isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.POOL_REWARD_TOKEN_ACCOUNT_A), isSigner: false, isWritable: true },
                { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: true },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.USER_COIN_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.POOL_REWARD_TOKEN_ACCOUNT_B), isSigner: false, isWritable: true }
              ],
        programId,
        data: Buffer.from([1, ...longToByteArray(amount)])
    });
    const transaction = new Transaction().add(instruction);
    let tx = await sendAndConfirmTransaction(
      connection,
      transaction,
      compoundAccount,
    );
    let prefix = amount > 0 ? "Staking" : "Harvest";
    console.log(prefix, "Transaction result", tx);
}

export async function balanceFunds() {
    // Get token A balance (COIN ie ATLAS/POLIS)
    let balanceCoin = await connection.getTokenAccountBalance(new PublicKey(process.env.USER_COIN_TOKEN_ACCOUNT));
    let balanceCoinBig = new BigNumber(parseInt(balanceCoin.value.amount));

    // Get token B balance (PC ie RAY/USDC)
    let balancePC = await connection.getTokenAccountBalance(new PublicKey(process.env.USER_PC_TOKEN_ACCOUNT));

    let coinAmountFromPc = coinPcRatio.multipliedBy(new BigNumber(balancePC.value.amount));

    console.log("amount of COIN (ATLAS/POLIS) that matches PC(RAY/USDC):", coinAmountFromPc.toFixed(0));

    let fromAmountCoinBig = balanceCoinBig.minus(coinAmountFromPc).dividedBy(new BigNumber(2));
    let fromAmountCoin = fromAmountCoinBig.toFixed(0);

    console.log('swapping COIN (ATLAS/POLIS) amount:', fromAmountCoin);

    let minToAmountPCBig = fromAmountCoinBig.dividedBy(coinPcRatio);
    let minToAmountPC = minToAmountPCBig.toFixed(0);

    let serumMarket = new PublicKey(process.env.AMM_SERUM_MARKET);
    let serumDEXProgramId = new PublicKey(process.env.AMM_SERUM_PROGRAM_ID);

    let market = await Market.load(connection, serumMarket, {
        skipPreflight: true,
        commitment: 'singleGossip',
        preflightCommitment: null,
    }, serumDEXProgramId);

    console.log('Converting ', fromAmountCoin*0.99, "COIN (ATLAS/POLIS) to >", minToAmountPC*0.9, "PC(RAY/USDC)");

    const instruction = new TransactionInstruction({
        keys: [
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: true },
                // amm
                { pubkey: new PublicKey(process.env.AMM_ID), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.AMM_AUTHORITY), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.AMM_OPEN_ORDERS), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.AMM_TARGET_ORDERS), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.AMM_POOL_COIN_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.AMM_POOL_PC_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
                // serum
                { pubkey: serumDEXProgramId, isSigner: false, isWritable: true },
                { pubkey: serumMarket, isSigner: false, isWritable: true },
                { pubkey: market.bidsAddress, isSigner: false, isWritable: true },
                { pubkey: market.asksAddress, isSigner: false, isWritable: true },
                { pubkey: market._decoded.eventQueue, isSigner: false, isWritable: true },
                { pubkey: market._decoded.baseVault, isSigner: false, isWritable: true },
                { pubkey: market._decoded.quoteVault, isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.AMM_SERUM_VAULT_SIGNER), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.USER_COIN_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(process.env.USER_PC_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
                { pubkey: compoundAccount.publicKey, isSigner: true, isWritable: true },
              ],
        programId: ammProgramId,
        data: Buffer.from([9, ...longToByteArray(fromAmountCoin*0.99), ...longToByteArray(minToAmountPC*0.9)])
    });
    const transaction = new Transaction().add(instruction);
    let tx = await sendAndConfirmTransaction(
      connection,
      transaction,
      compoundAccount,
    );
    console.log("Balance funds Transaction result " + tx);

}

export async function getPoolInfo() {

      let poolBalancePc = await connection.getTokenAccountBalance(new PublicKey(process.env.AMM_POOL_PC_TOKEN_ACCOUNT));
      let poolBalancePcBig = new BigNumber(poolBalancePc.value.amount);
      console.log('Balance of POOL PC:', poolBalancePc.value.amount);

      let poolBalanceCoin = await connection.getTokenAccountBalance(new PublicKey(process.env.AMM_POOL_COIN_TOKEN_ACCOUNT));
      let poolBalanceCoinBig = new BigNumber(parseInt(poolBalanceCoin.value.amount));
      console.log('Balance of POOL Coin:', poolBalanceCoin.value.amount);

      coinPcRatio = poolBalanceCoinBig.dividedBy(poolBalancePcBig);

}

export async function addLiquidity() {

    let balancePC = await connection.getTokenAccountBalance(new PublicKey(process.env.USER_PC_TOKEN_ACCOUNT));
    let balanceCoin = coinPcRatio.multipliedBy(new BigNumber(balancePC.value.amount)).toFixed(0);
    console.log('Using USER COIN balance of:', balanceCoin);
    console.log('Using USER PC balance of:', balancePC.value.amount);

    if (balanceCoin > 1000) {
        const instruction = new TransactionInstruction({
            keys: [
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: true },
                    { pubkey: new PublicKey(process.env.AMM_ID), isSigner: false, isWritable: true },
                    { pubkey: new PublicKey(process.env.AMM_AUTHORITY), isSigner: false, isWritable: true },
                    { pubkey: new PublicKey(process.env.AMM_OPEN_ORDERS), isSigner: false, isWritable: true },
                    { pubkey: new PublicKey(process.env.AMM_TARGET_ORDERS), isSigner: false, isWritable: true },
                    { pubkey: new PublicKey(process.env.AMM_LP_MINT_ADDRESS), isSigner: false, isWritable: true },
                    { pubkey: new PublicKey(process.env.AMM_POOL_COIN_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
                    { pubkey: new PublicKey(process.env.AMM_POOL_PC_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
                    { pubkey: new PublicKey(process.env.AMM_SERUM_MARKET), isSigner: false, isWritable: true },
                    { pubkey: new PublicKey(process.env.USER_COIN_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
                    { pubkey: new PublicKey(process.env.USER_PC_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
                    { pubkey: new PublicKey(process.env.USER_LP_TOKEN_ACCOUNT), isSigner: false, isWritable: true },
                    { pubkey: compoundAccount.publicKey, isSigner: true, isWritable: true }
                  ],
            programId: ammProgramId,
            data: Buffer.from([3, ...longToByteArray(balanceCoin*0.99), ...longToByteArray(balancePC.value.amount*0.97), ...longToByteArray(1)])
        });
        const transaction = new Transaction().add(instruction);
        let tx = await sendAndConfirmTransaction(
          connection,
          transaction,
          compoundAccount,
        );
        console.log("Add Liquidity Transaction result " + tx);

        // if (tx == "") {
        //     await addLiquidity();
        // }
    }
}

async function main() {
    try {

        dotenv.config()

        await establishConnection();

        await setCompoundAccount();

        programId = new PublicKey(process.env.PROGRAM_ID);
        ammProgramId = new PublicKey(process.env.AMM_PROGRAM_ID);

        await harvest();
        await sleep(2000);

        await getPoolInfo();

        await balanceFunds();
        await sleep(2000);

        await addLiquidity();
        await sleep(2000);

        let lpTokens = await connection.getTokenAccountBalance(new PublicKey(process.env.USER_LP_TOKEN_ACCOUNT));
        await deposit(lpTokens.value.amount);

    } catch (err) {
        console.log(err);
    }
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit());
