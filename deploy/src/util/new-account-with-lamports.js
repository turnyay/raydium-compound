import {Account, Connection} from '@solana/web3.js';
import sleep from './sleep';

export default async function newAccountWithLamports(
  connection,
  lamports,
) {
  const account = new Account();

  console.log('Trying to airdrop ' + lamports);

  // Separate into multiple airdrops of 9.9 (limit)
  let lamport_amount_single_ad = 9900000000;
  let max_tries = Math.ceil(lamports / lamport_amount_single_ad);

  let retries = 100;
  for (;;) {
    try {
        let result = await connection.requestAirdrop(account.publicKey, lamport_amount_single_ad);
        console.log(result);
    } catch(e) {
        console.log(e);
    }

    await sleep(1000);
    if (lamport_amount_single_ad * max_tries <= (await connection.getBalance(account.publicKey))) {
      return account;
    }
    if (--retries <= 0) {
      break;
    }
    console.log('Airdrop retry ' + retries);
  }

  throw new Error(`Airdrop of ${lamports} failed`);
}
