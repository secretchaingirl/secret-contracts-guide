#!/usr/bin/env node

/* eslint-disable @typescript-eslint/camelcase */
const {
    BroadcastMode, EnigmaUtils, Secp256k1Pen, CosmWasmClient, SigningCosmWasmClient, pubkeyToAddress, encodeSecp256k1Pubkey, makeSignBytes
} = require("secretjs");
const { Encoding } = require("@iov/encoding");
const { coin } = require("@cosmjs/launchpad");
const {
    Bip39,
    Random,
  } = require("@cosmjs/crypto");

const fs = require("fs");

function usage() {
    console.log("node secretjs-example-writing.js")
}

const customFees = {
    upload: {
        amount: [{ amount: "2000000", denom: "uscrt" }],
        gas: "2000000",
    },
    init: {
        amount: [{ amount: "500000", denom: "uscrt" }],
        gas: "500000",
    },
    exec: {
        amount: [{ amount: "500000", denom: "uscrt" }],
        gas: "500000",
    },
    send: {
        amount: [{ amount: "80000", denom: "uscrt" }],
        gas: "80000",
    },
}



// loadOrCreateMnemonic will try to load a mnemonic from the file.
// If missing, it will generate a random one and save to the file.
//
// This is not secure, but does allow simple developer access to persist a
// mnemonic between sessions
const loadOrCreateMnemonic = (filename) => {
    try {
        const mnemonic = fs.readFileSync(filename, "utf8");
        return mnemonic.trim();
        console.log(`mnemonic=${mnemonic}`)
    } catch (err) {
        const mnemonic = Bip39.encode(Random.getBytes(16)).toString();

        console.log(`mnemonic=${mnemonic}`)
        fs.writeFileSync(filename, mnemonic, "utf8");
        return mnemonic;
    }
}

const mnemonicToAddress = async (prefix, mnemonic) => {
    const pen = await Secp256k1Pen.fromMnemonic(mnemonic);
    const pubkey = encodeSecp256k1Pubkey(pen.pubkey);
    return pubkeyToAddress(pubkey, prefix);
}

async function main() {

    const httpUrl = "http://localhost:1317"

    // Tp use holodeck testnet instead
    // const httpUrl = "https://bootstrap.secrettestnet.io";

    // mainnet
    // const httpUrl = "https://api.secretapi.io/";

    const mnemonic = loadOrCreateMnemonic("foo.key");


    const signingPen = await Secp256k1Pen.fromMnemonic(mnemonic);
    const walletAddress = await mnemonicToAddress("secret", mnemonic);

    const txEncryptionSeed = EnigmaUtils.GenerateNewSeed();
    const client = new SigningCosmWasmClient(
        httpUrl,
        walletAddress,
        (signBytes) => signingPen.sign(signBytes),
        txEncryptionSeed, customFees
    );
    console.log(`Wallet address=${walletAddress}`)

    const wasm = fs.readFileSync("contracts/contract.wasm");
    const uploadReceipt = await client.upload(wasm, {});

    // Get the code ID from the receipt
    const codeId = uploadReceipt.codeId;

    // Create an instance
    const initMsg = {"count": 0}

    const contract = await client.instantiate(codeId, initMsg, "My Counter 2")
    console.log('Contract initialized')    

    const contractAddress = contract.contractAddress

    // Query the current count
    let response = await client.queryContractSmart(contractAddress, { "get_count": {}})

    console.log(`Count=${response.count}`)

    // The message to increment the counter requires no params
    const handleMsg = { increment: {} }

    // execute the message
    await client.execute(contractAddress, handleMsg);

    // Query again to confirm it worked
    response = await client.queryContractSmart(contractAddress, { "get_count": {}})

    console.log(`New Count=${response.count}`)    
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

