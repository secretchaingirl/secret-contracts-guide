#!/usr/bin/env node

/* eslint-disable @typescript-eslint/camelcase */
const {
    BroadcastMode, EnigmaUtils, Secp256k1Pen, CosmWasmClient, SigningCosmWasmClient, pubkeyToAddress, encodeSecp256k1Pubkey, makeSignBytes
  } = require("secretjs");
const { Encoding } = require("@iov/encoding");

const fs = require("fs");

function usage() {
  console.log("node secretjs-example-reading.js")
}

async function main() {    
  // connect to rest server
  // For reading, CosmWasmClient will suffice, we don't need to sign any transactions

  const client = new CosmWasmClient("http://localhost:1317")

  // Tp use holodeck testnet instead
  // const client = new CosmWasmClient("https://bootstrap.secrettestnet.io")

  // mainnet
  // const client = new CosmWasmClient("https://api.secretapi.io/")

  // query chain ID
  await client.getChainId()

  // query chain height
  await client.getHeight()

  // Get deployed code
  await client.getCodes()

  // Get the contracts for our simple counter
  const contracts = await client.getContracts(1)

  const contractAddress = contracts[0].address

  // Query the current count
  let response = await client.queryContractSmart(contractAddress, { "get_count": {}})

  console.log(`Count=${response.count}`)
}

main().then(
  () => {
    process.exit(0);
  },
  error => {
    console.error(error);
    process.exit(1);
  },
);

