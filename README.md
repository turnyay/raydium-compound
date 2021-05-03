# raydium-compound
Script to compound Raydium Fusion pools

# Warning
This software is unaudited - use at your own risk.\
Warning: This script will use *all* of the funds in the pool accounts to compound

# Prerequisites
You must have SOL in your wallet for tx costs.\
You must have funds deposited to one of Raydium.io's Fusion Pools.\
To do this:\
- go to sollet.io and save the seed phrase in a safe place
- obtain equal amount of the pool tokens, ie 100$ of RAY and 100$ of OXY
- go to raydium.io and in the app click "Liquidity", then "Connect" your wallet
- enter valid amounts, then select "Supply"
- once confirmed, add the LP token to the "Fusion" pool

Current config examples are for OXY-RAY and MEDIA-USDC, but can modify env for other pools.


# How it Works
1. Harvest - receive rewards
2. Balance Funds - swap some of the higher value token for lower value token - to maximize LP tokens
3. Add Liquidity - obtain more LP tokens
4. Stake LP Tokens - add to fusion pool


# Instructions (for OXYRAY or MEDIAUSDC pools)

1. Copy the example env file and remove '.example'
```
cp .env.oxyray.example .env.oxyray
```
2. Fill in your 12 or 24 word seed in COMPOUND_ACCOUNT_SEED with correct derivation path
- (if your address printed is not correct, try another path based on .env comments)

3. Fill in missing 4 accounts in the .env.<pool>
- Click "Harvest" with sollet, when the popup appears, copy and paste accounts by #:
```
USER_INFO_ACCOUNT - Account #3
USER_LP_TOKEN_ACCOUNT - Account #5
USER_PC_TOKEN_ACCOUNT - Account #7
USER_COIN_TOKEN_ACCOUNT - Account #11
```

4. Install packages
```
npm install
```

5. Run compound script
```
npm run oxy-ray
```
or
```
npm run media-usdc
```


# Setting up CRON job
Get path-to-node:
```
whereis node
```
Edit cron file
```
crontab -e
```
Save this line below to compound OXY-RAY once every hour:
```
0 * * * * cd <full-path-to-deploy-directory> && cp ./.env.oxyray .env && <path-to-node> --experimental-modules --es-module-specifier-resolution=node <full-path-to-deploy-directory>/src/compound.js 2>&1 | /usr/bin/logger -t oxy-ray
```
Verify running (after 1 hr passes)
```
tailf /var/log/syslog -n 3000 | grep oxy-ray
```
