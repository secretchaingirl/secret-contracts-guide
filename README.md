# enigma-dev-x
Notes on working with the cosmwasm-based smart contracts in the Enigma Blockchain

## Resources

- [cosmwasm repo](https://github.com/CosmWasm/cosmwasm)
- [cosmwasm starter pack - project template](https://github.com/confio/cosmwasm-template)
- [Setting up a local "devnet"](https://www.cosmwasm.com/docs/getting-started/using-the-sdk)
- [cosmwasm docs](https://www.cosmwasm.com/docs/intro/overview) 

## Prerequisites:
1. [Enigma Testnet with CosmWasm](https://github.com/enigmampc/EnigmaBlockchain/releases/tag/v0.1.0)
#### Download
```
wget https://github.com/enigmampc/EnigmaBlockchain/releases/download/v0.1.0/enigma-blockchain_0.1.0_amd64.deb
```
#### Install 
```
sudo dpkg -i enigmachain*.deb
```

#### Configure:

```bash
##### Set the testnet chain-id
enigmacli config chain-id enigma-testnet
```

```bash
enigmacli config output json
```

```bash
enigmacli config indent true
```

```bash
##### Set the full node address
enigmacli config node tcp://bootstrap.testnet.enigma.co:26657
```

```bash
##### Verify everything you receive from the full node
enigmacli config trust-node false
```

#### Check the installation:
```bash
enigmacli status
```

2. Create and fund a test account, eg developer as used throughout the rest of this doc
- Add account
```
enigmacli keys add developer
```
The output contains the new address, which you can also query with 
```
enigmacli keys show developer -a
```

- Fund account
[Enigma Testnet faucet](https://faucet.testnet.enigma.co/)
Confirm it's funded by checking the balance
```
enigmacli query account $(enigmacli keys show developer -a)
```

3. [Docker](https://docs.docker.com/install/)


## Setup
These are the steps required to get setup to use _compute_ (Enigma Blockchain's initial implementation of cosmwasm smart contracts)

NOTE: the latest release I used (0.1.0) is only for Debian/Ubuntu

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

Auto-generate msg schemas (when changed):

```
cargo schema
```

Schemas are json representations of the messages handled by the smart contract.

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
enigmacli tx compute store contract.wasm --from developer --gas 420000 -y
```

The gas amount _420000_ came from the examples in the cosmwasm docs.

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
This is like `discovery migrate` which handles both the deploying and creation of the contract instance, except in Cosmos the deploy-execute process consists of 3 steps rather than 2 in Ethereum.

To create an instance of this project we must also provide some JSON input data, a starting count.

```bash
INIT="{\"count\": 100000000}"
enigmacli tx compute instantiate 2 "$INIT" --from developer --label "my counter" -y
```

With the contract now initialized, we can find it's address
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



