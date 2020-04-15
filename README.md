# enigma-dev-x

This repository can be used to get up and running on a local Enigma Blockchain developer testnet (enigmadev) to start working with the cosmwasm-based smart contracts (soon to be secret contracts!).

A few important notes:
- smart contracts in this repo are a precursor to Enigma's Secret Contracts, which enable data privacy
- smart contracts are written in Rust and based on cosmwasm, and the module is referred to as `compute` in the Enigma Blockchain. This will be also true of Secret Contracts!
- these cosmwasm-based smart contracts should be reusable and easily modified once we incorporate data privacy

## Setup the Local Developer Testnet

1. Install [Docker](https://docs.docker.com/install/)

2. Clone the EnigmaBlockchain repository:

```
$ git clone https://github.com/enigmampc/EnigmaBlockchain.git
```

3. Build the local _enigmadev_ blockchain docker image:
```
docker build -f .\Dockerfile_build -t enigmadev .
```

4. Run the Docker _enigmadev_ image:

```
docker run --name enigmadev -t enigmadev
```

**NOTE**: The engimadev docker container can be stopped using `docker stop enigmadev` and re-started 
using `docker start -i enigmadev`.

In another terminal run a `bash` shell in the `enigmadev` container:
```
docker exec -it enigmadev /bin/bash
```

Check the keys:
```
enigmacli keys list --keyring-backend test
````

![](enigmacli-keys-list.png)


The local blockchain is configured with the following addresses:
```
address a: enigma1hczr6ps3vfjcsatj6l75hsuunfhzyzf9gpgpyq

address b: enigma1u93mxyscasnf3ukpd7shs88zusfjw98fn0ljxz

```


## Setup Enigma Smart Contracts (cosmwasm)

These are the steps required to get setup to use _compute_ (Enigma Blockchain's initial implementation of cosmwasm smart contracts)

NOTE: the latest release used (0.1.0) is only for Debian/Ubuntu

1. Install rustup
```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Install cc
```
$ sudo apt-get update
$ sudo apt-get install build-essential manpages-dev
```

2. Install pkg-config
```
$ sudo apt-get install pkg-config
```

3. Install cargo generate
```
cargo install cargo-generate --features vendored-openssl
```

4. Add rustup target wasm32
```
rustup target add wasm32-unknown-unknown
```

## Create Initial Smart Contract

1. Generate the smart contract project
```
cargo generate --git https://github.com/confio/cosmwasm-template.git --name <your-project-name>
```
The generate creates a directory with the project name and has this structure:

```
Cargo.lock	Developing.md	LICENSE		Publishing.md	examples	schema		tests
Cargo.toml	Importing.md	NOTICE		README.md	rustfmt.toml	src
```

## Compile

5. Built smart contract —> wasm (compile)
```
cargo wasm
```

## Unit Tests

Run unit tests
```
RUST_BACKTRACE=1 cargo unit-test
```

## Integration Tests

The integration tests are under the `tests/` directory and run as:

```
cargo integration-test
```

## Generate Msg Schemas

We can also generate JSON Schemas that serve as a guide for anyone trying to use the contract. To specify which arguments they need.

Auto-generate msg schemas (when changed):

```
cargo schema
```


## Deploy Smart Contract

Before deploying or storing the contract on the testnet, need to install Docker and run the cosmwasm optimizer.

### Install Docker for Debian

If you don't already have Docker installed,

https://docs.docker.com/install/

### Optimize compiled wasm

```
docker run --rm -v $(pwd):/code \
  --mount type=volume,source=$(basename $(pwd))_cache,target=/code/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  confio/cosmwasm-opt:0.7.0
```
The contract wasm needs to be optimized to get a smaller footprint. Cosmwasm notes state the contract would be too large for the blockchain unless optimized. This example contract.wasm is 1.8M before optimizing, 90K after.

The optimization creates two files:
- contract.wasm
- hash.txt

### Store the Smart Contract on Testnet

Upload the optimized contract.wasm to the enigma-testnet:

```
enigmacli tx compute store contract.wasm --from developer --gas auto -y
```

Uploading verified code requires 2 additional params, source and builder
```

```

### Querying the Smart Contract and Code

12. List current smart contract code on testnet
```
$ enigmacli query compute list-code
[
  {
    "id": 1,
    "creator": "enigma1vch5dkz89a7hp3nn0ycrlr9y798nlk7qs0encd",
    "data_hash": "3DFA55F790A636C11AE2936473734A4D271D441F32D0CFCD7AC19C17B162F85B",
    "source": "https://crates.io/api/v1/crates/cw-erc20/0.3.0/download",
    "builder": "confio/cosmwasm-opt:0.7.3"
  },
  {
    "id": 2,
    "creator": "enigma1d5gs5mekx9kggjlxjx08gz98ragulw6gu8s2vs",
    "data_hash": "D4FA35C5F7A0547727BAE923F320F925FCD4562634D753E1E9C27D03CB823D01",
    "source": "",
    "builder": ""
  }
]
```

Our contract is the 2nd one in the list above.

### Instantiate the Smart Contract

At this point the contract's been uploaded and stored on the testnet, but there's no "instance." 
This is like `discovery migrate` which handles both the deploying and creation of the contract instance, except in Cosmos the deploy-execute process consists of 3 steps rather than 2 in Ethereum. You can read more about the logic behind this decision, and other comparisons to Solidity, in the [cosmwasm documentation](https://www.cosmwasm.com/docs/getting-started/smart-contracts). These steps are:
1. Upload Code - Upload some optimized wasm code, no state nor contract address (example Standard ERC20 contract)
2. Instantiate Contract - Instantiate a code reference with some initial state, creates new address (example set token name, max issuance, etc for my ERC20 token)
3. Execute Contract - This may support many different calls, but they are all unprivileged usage of a previously instantiated contract, depends on the contract design (example: Send ERC20 token, grant approval to other contract)

To create an instance of this project we must also provide some JSON input data, a starting count.

```bash
INIT="{\"count\": 100000000}"
enigmacli tx compute instantiate 2 "$INIT" --from developer --label "my counter" -y
```

With the contract now initialized, we can find its address
```bash
enigmacli query compute list-contract-by-code 2
```
Our instance is enigma1gv07846a3867ezn3uqkk082c5ftke7hpwhpqzz

We can query the contract state
```bash
CONTRACT=enigma1gv07846a3867ezn3uqkk082c5ftke7hpwhpqzz
enigmacli query compute contract-state smart $CONTRACT "{\"getcount\": {}}"
```

And we can increment our counter
```bash
enigmacli tx compute execute $CONTRACT "{\"increment\": {}}" --from developer
```

## Smart Contract

### Project Structure

The source directory (`src/`) has these files:
```
contract.rs  lib.rs  msg.rs  state.rs
```

The `contract.rs` file is the one that developers modify, though I found smart contract-specific code in `state.rs` and `msg.rs`. My understanding is that the developer will modify `contract.rs` for the logic, `state.rs` for the data the contract will use as state, and  `msg.rs` to define the messages handled by the contract.

```
state.rs
msg.rs
```

The `msg.rs` file is where the InitMsg parameters are specified (like a constructor), the types of Query (GetCount) and Handle[r] (Increment) messages, and any custom structs for each query response.

```
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InitMsg {
    pub count: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum HandleMsg {
    Increment {},
    Reset { count: i32 },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum QueryMsg {
    // GetCount returns the current count as a json-encoded number
    GetCount {},
}

// We define a custom struct for each query response
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct CountResponse {
    pub count: i32,
}

```

### Unit Tests

Unit tests are coded in the `contract.rs` file itself:

```
#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm::errors::Error;
    use cosmwasm::mock::{dependencies, mock_env};
    use cosmwasm::serde::from_slice;
    use cosmwasm::types::coin;

    #[test]
    fn proper_initialization() {
        let mut deps = dependencies(20);

        let msg = InitMsg { count: 17 };
        let env = mock_env(&deps.api, "creator", &coin("1000", "earth"), &[]);

        // we can just call .unwrap() to assert this was a success
        let res = init(&mut deps, env, msg).unwrap();
        assert_eq!(0, res.messages.len());

        // it worked, let's query the state
        let res = query(&deps, QueryMsg::GetCount {}).unwrap();
        let value: CountResponse = from_slice(&res).unwrap();
        assert_eq!(17, value.count);
    }
...

```
## Local dev with Docker and CosmWasm CLI

### Docker setup

```bash
# Start enigmachain
docker run -d -p 26657:26657 -p 26656:26656 -p 1317:1317 \
 -v ~/.enigmad:/root/.enigmad -v ~/.enigmacli:/root/.enigmacli \
 -v $(pwd):/code \
 --name enigmadev enigmadev

# Start the rest API server
docker exec enigmadev \
  enigmacli rest-server \
  --node tcp://localhost:26657 \
  --trust-node \
  --laddr tcp://0.0.0.0:1317  
```

### CosmWasm CLI
#### Resources:

- name-app

[Name Service Introduction](https://www.cosmwasm.com/docs/name-service/intro)

[name-app repo](https://github.com/CosmWasm/name-app)

- REPL

[CosmWasm CLI](https://github.com/CosmWasm/cosmwasm-js/blob/master/packages/cli/README.md)

[CosmWasmClient Part 1: Reading](https://medium.com/confio/cosmwasmclient-part-1-reading-e0313472a158)

```bash
# Install cosmwasm in your project with yarn (See docs for other options)
yarn add @cosmwasm/cli --dev

# Start cli
./node_modules/.bin/cosmwasm-cli --init helpers.ts

```

```bash
# Configure custom network so we use the local enigma testnet

const enigmaOptions = {
  httpUrl: "http://localhost:1317",
  networkId: "enigma-testnet",
  feeToken: "uscrt",
  gasPrice: 0.025,
  bech32prefix: "enigma",
}

# load or create Mnemonic from file
const mnemonic = loadOrCreateMnemonic("foo.key");

# connect to enigmachain
const {address, client} = await connect(mnemonic, enigmaOptions);

# show all code and contracts
client.getCodes()

# get account, if empty use a faucet or send some uscrt
client.getAccount();

# query the first contract for first code
const contracts = await client.getContracts(1);

# show info like the init message
const info = await client.getContract(contracts[0].address)
info
info.initMsg

const contractAddress = contracts[0].address

# Query the current counter value
smartQuery(client, contractAddress, { getcount: {} })

# Increment the counter
const execMsg = { increment: {}}
const exec = await client.execute(contractAddress, execMsg);
exec
exec.logs[0].events[0]
smartQuery(client, fooAddr, { balance: { address: rcpt } })

# Confirm the counter incremented
smartQuery(client, contractAddress, { getcount: {} })

```

## Resources
Smart Contracts in the Enigma Blockchain use cosmwasm. Therefore, for troubleshooting and additional context, cosmwasm documentation may be very useful. Here are some of the links we relied on in putting together this guide:

- [cosmwasm repo](https://github.com/CosmWasm/cosmwasm)
- [cosmwasm starter pack - project template](https://github.com/CosmWasm/cosmwasm-template)
- [Setting up a local "testnet"](https://www.cosmwasm.com/docs/getting-started/using-the-sdk)
- [cosmwasm docs](https://www.cosmwasm.com/docs/intro/overview) 
