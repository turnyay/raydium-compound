
import {sendAndConfirmTransaction as realSendAndConfirmTransaction} from '@solana/web3.js';
import {Account, Connection, Transaction} from '@solana/web3.js';

export default async function sendAndConfirmTransaction(
  connection,
  transaction,
  ...signers
) {
  let signature = "";
  try {
      signature = await realSendAndConfirmTransaction(
          connection,
          transaction,
          signers,
          {
              skipPreflight: true,
              commitment: 'singleGossip',
              preflightCommitment: null,
          },
      );
  } catch (e) {
    console.log(e);
  }
  return signature;
}
