# Indexd Server
[![build status](https://secure.travis-ci.org/CounterpartyXCP/indexd-server.png)](http://travis-ci.org/CounterpartyXCP/indexd-server)

A [bitcoind](https://github.com/bitcoin/bitcoin) transaction server.

## Indexes
This server provides an API for unspent transaction outputs for bitcoin addresses.  

## Configuration

### .env file
Copy `.env-example` to `.env` and modify the `.env` file as needed.  To use a custom configuration file, you can specify a file path by setting the `CONFIG_FILE` environment variable to the location of your environment config path.


### bitcoin.conf configuration
Your bitcoin server must have [ZMQ enabled](https://github.com/bitcoin/bitcoin/blob/master/doc/zmq.md).  You can configure `bitcoin.conf` to publish tx and block hashes, like so:

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


## API Example
Once the server is running, you can call an API like this:
```
http://localhost:{SERVER_PORT}/a/2N6Zt9392GjJDpx82JWNoYvXDMjVvRYDksL/utxos
```

And receive a response like this:
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
