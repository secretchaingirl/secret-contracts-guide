# Secret Contracts Guide

This repository can be used to master Secret Contract development! In this document you'll find information on setting up a local Secret Network developer testnet (secretdev), learning secret contract basics and shortcuts to improve your development experience and finally build and deploy secret contracts of varying complexity with UIs to create you very own Secret Apps.

To learn more about secret contracts, please visit our [documentation page](https://build.scrt.network/dev/secret-contracts.html).

## Setup the Local Developer Testnet

The developer blockchain is configured to run inside a docker container. Install [Docker](https://docs.docker.com/install/) for your environment (Mac, Windows, Linux).

Open a terminal window and change to your project directory.
Then start SecretNetwork, labelled _secretdev_ from here on:

```
$ docker run -it --rm \
 -p 26657:26657 -p 26656:26656 -p 1317:1317 \
 --name secretdev enigmampc/secret-network-sw-dev:v1.0.2
```

**NOTE**: The _secretdev_ docker container can be stopped by CTRL+C

![](docker-run.png)

At this point you're running a local SecretNetwork full-node. Let's connect to the container so we can view and manage the secret keys:

**NOTE**: In a new terminal
```
docker exec -it secretdev /bin/bash
```

The local blockchain has a couple of keys setup for you (similar to accounts if you're familiar with Truffle Ganache). The keys are stored in the `test` keyring backend, which makes it easier for local development and testing.

```
secretcli keys list --keyring-backend test
````

![](secretcli-keys-list.png)

`exit` when you are done

## Setup Secret Contracts

In order to setup Secret Contracts on your development environment, you will need to:
- install Rust (you don't need to be a Rust expert to build Secret Contracts and you can check out the Rust book, rustlings course, examples to learn more at https://www.rust-lang.org/learn)
- install the Rust dependencies
- create your first project

The Rust dependencies include the Rust compiler, cargo (_package manager_), toolchain and a package to generate projects (you can check out the Rust book, rustlings course, examples and more at https://www.rust-lang.org/learn).


1. Install Rust

More information about installing Rust can be found here: https://www.rust-lang.org/tools/install.

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

2. Add rustup target wasm32 for both stable and nightly

```
rustup default stable
rustup target list --installed
rustup target add wasm32-unknown-unknown

rustup install nightly
rustup target add wasm32-unknown-unknown --toolchain nightly
```

3. If using linux, install the standard build tools:
```
apt install build-essential
```

4. Run cargo install cargo-generate

Cargo generate is the tool you'll use to create a smart contract project (https://doc.rust-lang.org/cargo).

```
cargo install cargo-generate --features vendored-openssl
```

## Create Initial Smart Contract

To create the smart contract you'll:
- generate the initial project
- compile the smart contract
- run unit tests
- optimize the wasm contract bytecode to prepare for deployment
- deploy the smart contract to your local SecretNetwork
- instantiate it with contract parameters

### Generate the smart contract project

```
cargo generate --git https://github.com/enigmampc/secret-template --name mysimplecounter
```

The git project above is a cosmwasm smart contract template that implements a simple counter. The contract is created with a parameter for the initial count and allows subsequent incrementing.

Change directory to the project you created and view the structure and files that were created.

```
cd mysimplecounter
```

The generate creates a directory with the project name and has this structure:

```
Cargo.lock	Developing.md	LICENSE		Publishing.md	examples	schema		tests
Cargo.toml	Importing.md	NOTICE		README.md	rustfmt.toml	src
```

### Compile

Use the following command to compile the smart contract which produces the wasm contract file.

```
cargo wasm
```

### Unit Tests 

#### Run unit tests

```
RUST_BACKTRACE=1 cargo unit-test
```

#### Integration Tests

The integration tests are under the `tests/` directory and run as:

```
cargo integration-test
```

#### Generate Msg Schemas

We can also generate JSON Schemas that serve as a guide for anyone trying to use the contract, to specify which arguments they need.

Auto-generate msg schemas (when changed):

```
cargo schema
```


### Deploy Smart Contract

Before deploying or storing the contract on the testnet, you need to run the [secret contract optimizer](https://hub.docker.com/r/enigmampc/secret-contract-optimizer).

#### Optimize compiled wasm

```
docker run --rm -v "$(pwd)":/contract \
  --mount type=volume,source="$(basename "$(pwd)")_cache",target=/code/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  enigmampc/secret-contract-optimizer  
```
The contract wasm needs to be optimized to get a smaller footprint. Cosmwasm notes state the contract would be too large for the blockchain unless optimized. This example contract.wasm is 1.8M before optimizing, 90K after.

This creates a zip of two files:
- contract.wasm
- hash.txt

#### Store the Smart Contract on our local Testnet

```
# First lets start it up again, this time mounting our project's code inside the container.
docker run -it --rm \
 -p 26657:26657 -p 26656:26656 -p 1317:1317 \
 -v $(pwd):/root/code \
 --name secretdev enigmampc/secret-network-sw-dev:v1.0.2
 ```

Upload the optimized contract.wasm.gz:

```
docker exec -it secretdev /bin/bash

cd code

secretcli tx compute store contract.wasm.gz --from a --gas 1000000 -y --keyring-backend test
```

#### Querying the Smart Contract and Code

List current smart contract code
```
secretcli query compute list-code
[
  {
    "id": 1,
    "creator": "secret1zy80x04d4jh4nvcqmamgjqe7whus5tcw406sna",
    "data_hash": "D98F0CA3E8568B6B59772257E07CAC2ED31DD89466BFFAA35B09564B39484D92",
    "source": "",
    "builder": ""
  }
]
```

### Instantiate the Smart Contract

At this point the contract's been uploaded and stored on the testnet, but there's no "instance."
This is like `discovery migrate` which handles both the deploying and creation of the contract instance, except in Cosmos the deploy-execute process consists of 3 steps rather than 2 in Ethereum. You can read more about the logic behind this decision, and other comparisons to Solidity, in the [cosmwasm documentation](https://www.cosmwasm.com/docs/getting-started/smart-contracts). These steps are:
1. Upload Code - Upload some optimized wasm code, no state nor contract address (example Standard ERC20 contract)
2. Instantiate Contract - Instantiate a code reference with some initial state, creates new address (example set token name, max issuance, etc for my ERC20 token)
3. Execute Contract - This may support many different calls, but they are all unprivileged usage of a previously instantiated contract, depends on the contract design (example: Send ERC20 token, grant approval to other contract)

To create an instance of this project we must also provide some JSON input data, a starting count.

```bash
INIT="{\"count\": 100000000}"
CODE_ID=1
secretcli tx compute instantiate $CODE_ID "$INIT" --from a --label "my counter" -y --keyring-backend test
```

With the contract now initialized, we can find its address
```bash
secretcli query compute list-contract-by-code 1
```
Our instance is secret18vd8fpwxzck93qlwghaj6arh4p7c5n8978vsyg

We can query the contract state
```bash
CONTRACT=secret18vd8fpwxzck93qlwghaj6arh4p7c5n8978vsyg

secretcli query compute query $CONTRACT "{\"get_count\": {}}"
```

And we can increment our counter
```bash
secretcli tx compute execute $CONTRACT "{\"increment\": {}}" --from a --keyring-backend test
```

## Secret Contracts 101

### Project Structure

The source directory (`src/`) has these files:
```
contract.rs  lib.rs  msg.rs  state.rs
```

The developer modifies `contract.rs` for contract logic, contract entry points are `init`, `handle` and `query` functions.

`init` in the Counter contract initializes the storage, specifically the current count and the signer/owner of the instance being initialized.

We also define `handle`, a generic handler for all functions writing to storage, the counter can be incremented and reset. These functions are provided the storage and the environment, the latter's used by the `reset` function to compare the signer with the contract owner.

Finally we have `query` for all functions reading state, we only have `query_count`, returning the counter state.

The rest of the contract file is unit tests so you can confidently change the contract logic.

The `state.rs` file defines the State struct, used for storing the contract data, the only information persisted between multiple contract calls.

The `msg.rs` file is where the InitMsg parameters are specified (like a constructor), the types of Query (GetCount) and Handle[r] (Increment) messages, and any custom structs for each query response.

```rs
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
### Secret Contract code explanation

Use [this link](https://github.com/enigmampc/SecretSimpleVote/blob/master/src/contract.rs) to a see a sample voting contract and a line by line description of everything you need to know


### Unit Tests

Unit tests are coded in the `contract.rs` file itself:

```rs
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
```

## Secret Toolkit
[Secret Toolkit](https://github.com/enigmampc/secret-toolkit) is a collection of Rust packages that contain common tools used in development of Secret Contracts running on the Secret Network.

## Secret Contracts - Advanced
Use [this link](https://github.com/baedrik/SCRT-sealed-bid-auction) for a sealed-bid (secret) auction contract that makes use of [SNIP-20](https://github.com/enigmampc/snip20-reference-impl) and a walkthrough of the contract

## Path to Secret Apps, build a UI using secret.js
Now that we have mastered secret contract development, let's see how to connect a secret contract to a front-end using secret.js and how to add wallet functionality using Keplr.

### secret.js
Secret.js is how users interact with Secret Network. Secret.js is mostly based on CosmWasm.js. While secret.js documents are being updated, you can refer to CosmWasm.js doucments
- [CosmWasm JS](cosmwasm-js.md)
- [Frontend development](building-a-frontend.md)


### Keplr integration
[Keplr](https://wallet.keplr.app/#/dashboard) is the web wallet users need to interact with Secret Applications. Please use [this link](https://github.com/enigmampc/SecretJS-Templates/blob/master/ReactJS%2BKeplr.js) for a sample implementation of Keplr and Secret.js

## Other sesources

### Privacy model of secret contracts
Secret Contracts are based on CosmWasm v0.10, but they have additional privacy properties that can only be found on Secret Network.Secret Contract developers must always consider the trade-off between privacy, user experience, performance and gas usage. Please use this [link](https://build.scrt.network/dev/privacy-model-of-secret-contracts.html) to learn more about the privacy model of secret contracts.

### Tutorials from Secret Network community
Visit [this link](https://github.com/levackt/datahub-learn/tree/feature/secret/network-documentation/secret/tutorials) for all tutorials about Secret Network (WIP)

### CosmWasm resources
Smart Contracts in the Secret Network based based on CosmWasm. Therefore, for troubleshooting and additional context, CosmWasm documentation may be very useful. Here are some of the links we relied on in putting together this guide:

- [cosmwasm repo](https://github.com/CosmWasm/cosmwasm)
- [cosmwasm starter pack - project template](https://github.com/CosmWasm/cosmwasm-template)
- [Setting up a local "testnet"](https://www.cosmwasm.com/docs/getting-started/using-the-sdk)
- [cosmwasm docs](https://www.cosmwasm.com/docs/intro/overview) 

