# Indexd Server
[![build status](https://secure.travis-ci.org/CounterpartyXCP/indexd-server.png)](http://travis-ci.org/CounterpartyXCP/indexd-server)

A [bitcoind](https://github.com/bitcoin/bitcoin) transaction server.

## Indexes
This server provides an API for unspent transaction outputs for bitcoin addresses.  

## Configuration

### .env file
Copy `.env-example` to `.env` and modify the `.env` file as needed.  To use a custom configuration file, you can specify a file path by setting the `CONFIG_FILE` environment variable to the location of your environment config path.


### bitcoin.conf configuration
Your bitcoin server must have [ZMQ enabled](https://github.com/bitcoin/bitcoin/blob/master/doc/zmq.md).  Then configure `bitcoin.conf` to publish tx and block hashes, like so:

```
zmqpubhashtx=tcp://127.0.0.1:38832
zmqpubhashblock=tcp://127.0.0.1:38832
```

The settings in bitcoin.conf are the "server" settings for the ZMQ publisher.  The ZMQ variable in the `.env` file is the "client" to subscribe to the messages published by bitcoin.


## Install
Install the node dependencies:
```shell
npm install
```

## Run the server
The recommended way to run the server is with [forever](https://www.npmjs.com/package/forever).

```shell
npm -g install forever
forever index.js
```


## API Endpoint Examples

### UTXOs Endpoint

The utxos API endpoint looks like this:
```
http://localhost:{SERVER_PORT}/a/2N6Zt9392GjJDpx82JWNoYvXDMjVvRYDksL/utxos
```

And returns a response like this:
```json
[
    {
        "txId": "0b3c631c032c0b6923f35f80a3793024179ad04c4f766a9f3067eb1d3efb5de6",
        "vout": 1,
        "value": 59300,
        "height": 1162483,
        "confirmations": 48639
    },
    {
        "txId": "24a6ec05e3edcd46c394c35d8bf47f69d3f626bd819f25c5a2a62de8ebc64827",
        "vout": 1,
        "value": 10000000,
        "confirmations": 0
    }
]
```

### Transactions Endpoint


The transactions API endpoint looks like this:
```
http://localhost:{SERVER_PORT}/a/2N6Zt9392GjJDpx82JWNoYvXDMjVvRYDksL/txs
```

And returns a response like this:
```json
{
    "00ef1c20ed31967bba657add442fe31f0c911a1ee12b8ca6b01c7bb336f50dbe": "010000000138000b78c1da461aa8e615474734477bb526c4a748bd7afa2d24d19a2516652600000000fdfe0000483045022100c6745056ac217d56191eb89fd15462a1431058bc6576265b679b4a68eca27e1e02200fdc3072f18bcae804bc824cf66c2eb6bedbd602d9301ad094d7cb1cebac623d01483045022100c3a22a1c219b6b0266d62b94b990f39eb6bdd401189fd283188d1795c6faee9802201e7f9119c137595ac088f1831417a63ce4270341ef4a6873f6729e8b6365c539014c69522103e3996bbfaee29838287a46d73e348f30709c2a60148cf23aa1bed935b2bcc52d2103ab3f25a845c772718d11af25e5e90554515ffc84be1de8480132bb7b39fe616b2102e8efe29657bcc985b071e3f22c65a7059cc63645bffdd831a6363d338abb5a2653aeffffffff02e8604800000000001976a9149d24230ec8c79f11f035533b7055b48071bb228488ac062750000000000017a9142d0cd3469b56303a4d9e63b17e23b2ed1d3a15928700000000"
}
```


The transactions API also accepts a verbose query parameter like this:
```
http://localhost:{SERVER_PORT}/a/2N6Zt9392GjJDpx82JWNoYvXDMjVvRYDksL/txs?verbose=1
```

And returns a response like this:

```json
{
    "00ef1c20ed31967bba657add442fe31f0c911a1ee12b8ca6b01c7bb336f50dbe": {
        "blockhash": "0000000000b226562a42151634455441e4446857dba7e3fd3f3c5ced86754a1a",
        "blocktime": 1504967988,
        "confirmations": 30704,
        "hash": "00ef1c20ed31967bba657add442fe31f0c911a1ee12b8ca6b01c7bb336f50dbe",
        "hex": "010000000138000b78c1da461aa8e615474734477bb526c4a748bd7afa2d24d19a2516652600000000fdfe0000483045022100c6745056ac217d56191eb89fd15462a1431058bc6576265b679b4a68eca27e1e02200fdc3072f18bcae804bc824cf66c2eb6bedbd602d9301ad094d7cb1cebac623d01483045022100c3a22a1c219b6b0266d62b94b990f39eb6bdd401189fd283188d1795c6faee9802201e7f9119c137595ac088f1831417a63ce4270341ef4a6873f6729e8b6365c539014c69522103e3996bbfaee29838287a46d73e348f30709c2a60148cf23aa1bed935b2bcc52d2103ab3f25a845c772718d11af25e5e90554515ffc84be1de8480132bb7b39fe616b2102e8efe29657bcc985b071e3f22c65a7059cc63645bffdd831a6363d338abb5a2653aeffffffff02e8604800000000001976a9149d24230ec8c79f11f035533b7055b48071bb228488ac062750000000000017a9142d0cd3469b56303a4d9e63b17e23b2ed1d3a15928700000000",
        "locktime": 0,
        "size": 373,
        "time": 1504967988,
        "txid": "00ef1c20ed31967bba657add442fe31f0c911a1ee12b8ca6b01c7bb336f50dbe",
        "version": 1,
        "vin": [
            {
                "scriptSig": {
                    "asm": "0 3045022100c6745056ac217d56191eb89fd15462a1431058bc6576265b679b4a68eca27e1e02200fdc3072f18bcae804bc824cf66c2eb6bedbd602d9301ad094d7cb1cebac623d[ALL] 3045022100c3a22a1c219b6b0266d62b94b990f39eb6bdd401189fd283188d1795c6faee9802201e7f9119c137595ac088f1831417a63ce4270341ef4a6873f6729e8b6365c539[ALL] 522103e3996bbfaee29838287a46d73e348f30709c2a60148cf23aa1bed935b2bcc52d2103ab3f25a845c772718d11af25e5e90554515ffc84be1de8480132bb7b39fe616b2102e8efe29657bcc985b071e3f22c65a7059cc63645bffdd831a6363d338abb5a2653ae",
                    "hex": "00483045022100c6745056ac217d56191eb89fd15462a1431058bc6576265b679b4a68eca27e1e02200fdc3072f18bcae804bc824cf66c2eb6bedbd602d9301ad094d7cb1cebac623d01483045022100c3a22a1c219b6b0266d62b94b990f39eb6bdd401189fd283188d1795c6faee9802201e7f9119c137595ac088f1831417a63ce4270341ef4a6873f6729e8b6365c539014c69522103e3996bbfaee29838287a46d73e348f30709c2a60148cf23aa1bed935b2bcc52d2103ab3f25a845c772718d11af25e5e90554515ffc84be1de8480132bb7b39fe616b2102e8efe29657bcc985b071e3f22c65a7059cc63645bffdd831a6363d338abb5a2653ae"
                },
                "sequence": 4294967295,
                "txid": "266516259ad1242dfa7abd48a7c426b57b4734474715e6a81a46dac1780b0038",
                "vout": 0
            }
        ],
        "vout": [
            {
                "n": 0,
                "scriptPubKey": {
                    "addresses": [
                        "muqqg1Yvojwz2Kg5h4X31PAcutqaDroep1"
                    ],
                    "asm": "OP_DUP OP_HASH160 9d24230ec8c79f11f035533b7055b48071bb2284 OP_EQUALVERIFY OP_CHECKSIG",
                    "hex": "76a9149d24230ec8c79f11f035533b7055b48071bb228488ac",
                    "reqSigs": 1,
                    "type": "pubkeyhash"
                },
                "value": 0.047434
            },
            {
                "n": 1,
                "scriptPubKey": {
                    "addresses": [
                        "2MwMRm2u1U2sVeYssdbAqV7UUM9fjXteDk3"
                    ],
                    "asm": "OP_HASH160 2d0cd3469b56303a4d9e63b17e23b2ed1d3a1592 OP_EQUAL",
                    "hex": "a9142d0cd3469b56303a4d9e63b17e23b2ed1d3a159287",
                    "reqSigs": 1,
                    "type": "scripthash"
                },
                "value": 0.0525287
            }
        ],
        "vsize": 373
    }
}
```


### Status Endpoint

To check on the status of the index while it is syncing, you can call:
```
http://localhost:{SERVER_PORT}/status
```

And receive a response like this:
```json
{
    "chainBlock": 1211187,
    "indexBlock": 11274,
    "blocksBehind": 1199913,
    "ready": false
}
```


## License [MIT](LICENSE)
