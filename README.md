# Indexd Server
[![build status](https://secure.travis-ci.org/CounterpartyXCP/indexd-server.png)](http://travis-ci.org/CounterpartyXCP/indexd-server)

A [bitcoind](https://github.com/bitcoin/bitcoin) transaction server.

## Indexes
This server provides an API for unspent transaction outputs for bitcoin addresses.  

## Configuration
Copy `.env-example` to `.env` and modify the `.env` file as needed.

Your bitcoin server must have [ZMQ enabled](https://github.com/bitcoin/bitcoin/blob/master/doc/zmq.md).  

You can specify a custom configuration file by setting the `CONFIG_FILE` environmanet variable to your environment config path.

## Run the server
The reccomended way to run the server is with (forever)[https://www.npmjs.com/package/forever].

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
        "amount": 0.000593,
        "confirmations": 48639,
        "height": 1162483,
        "txid": "0b3c631c032c0b6923f35f80a3793024179ad04c4f766a9f3067eb1d3efb5de6",
        "value": 59300,
        "vout": 1
    },
    {
        "amount": 0.1,
        "confirmations": 0,
        "txid": "24a6ec05e3edcd46c394c35d8bf47f69d3f626bd819f25c5a2a62de8ebc64827",
        "value": 10000000,
        "vout": 1
    }
]
```

## License [MIT](LICENSE)
