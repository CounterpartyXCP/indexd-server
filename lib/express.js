let debug = require('debug')('express')
let bitcoin = require('bitcoinjs-lib')
let bodyParser = require('body-parser')
let express = require('express')
let parallel = require('run-parallel')
let rpc = require('./rpc')
let bech32 = require('bech32')

function Hex256bit (value) {
  return typeof value === 'string' &&
    /^([0-9a-f]{2})+$/i.test(value) &&
    value.length === 64
}

module.exports = function initialize (adapter, opts) {
  let router = new express.Router()
  let networkName = 'mainnet'
  let network = bitcoin.networks.bitcoin

  if (opts.testnet) {
    network = bitcoin.networks.testnet
    networkName = 'testnet'
  } else if (opts.regtest) {
    network = bitcoin.networks.testnet
    networkName = 'regtest'
  }

  function respond (req, res, err, result) {
    if (err) debug('ERR: '+req.path, err)
    if (err) {
      let errMsg
      if (typeof err === 'number') {
        res.status(err)
      } else {
        if (typeof err === 'object' && err.message) {
          res.status((err.status && typeof err.status === 'number') ? err.status : 400)
          errMsg = ''+err.message
        } else {
          res.status(400)
          errMsg = ''+err
        }
      }
      res.json({error: errMsg})
      return res.end()
    }

    res.status(200)
    if (result !== undefined) {
      if (typeof result === 'string') res.send(result)
      else if (Buffer.isBuffer(result)) res.send(result)
      else res.json(result)
    }
    res.end()
  }

  function resolveHeight (heightQuery) {
      let height = parseInt(heightQuery)
      if (!Number.isFinite(height)) height = 0
      return height
  }

  router.get('/status', (req, res) => {
    parallel({
      localtip: (cb) => adapter.tips(cb),
      bitcoinheight: (cb) => rpc('getblockcount', [], cb)
    }, (err, results) => {
      if (err) return respond(req, res, err)

      let localheight = results.localtip ? results.localtip.txo.height : 0
      let bitcoinheight = results.bitcoinheight
      status = {
        chainBlock: bitcoinheight,
        indexBlock: localheight,
        network: networkName,
        blocksBehind: (bitcoinheight && localheight) ? (bitcoinheight - localheight) : null,
        ready: bitcoinheight && localheight && (bitcoinheight - localheight) <= 1,
      }

      respond(req, res, null, status)
    })
  })

  function addressToScriptId(address) {
    let script = null

    if (address.startsWith('bc') || address.startsWith('tb')) {
      // Regtest starts with 'bc' too
      let b32res = bech32.decode(address)
      let witnessData = bech32.fromWords(b32res.words.slice(1))
      let witnessOpcodes = [0, 0x14]
      script = Buffer.from(witnessOpcodes.concat(witnessData))
    } else {
      script = bitcoin.address.toOutputScript(address, network)
      console.log('Output Script ID', script.toString('hex'))
    }

    return bitcoin.crypto.sha256(script).toString('hex')
  }

  router.get('/a/:address/utxos', (req, res) => {
    let scId
    try {
      scId = addressToScriptId(req.params.address)
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)

    // add confirmations to utxos
    parallel({
      tip: (cb) => adapter.tips(cb),
      utxos: (cb) => adapter.utxosByScriptRange({scId, heightRange: [0, 2500000]}, 3000000, cb) // TODO: Make these values a sliding window and step over them
    }, (err, results) => {
      if (err) return respond(req, res, err)

      let tipHeight = results.tip.txo.height
      let utxos = []

      Object.keys(results.utxos).forEach(function (key) {
        let utxo = results.utxos[key]
        let height = utxo.height
        if (height && height <= tipHeight) {
          utxo.confirmations = tipHeight - height + 1
        } else {
          utxo.confirmations = 0
        }

        // we don't care about the scId
        delete utxo.scId

        utxos.push(utxo)
      })
      respond(req, res, null, utxos)
    })
  })
let inspect = require('util').inspect
  router.get('/a/:address/txos', (req, res) => {
    let scId
    try {
      scId = addressToScriptId(req.params.address)
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)

    let n = 0
    let resps = []
    adapter.utxosByScriptRange({scId, heightRange: [0, 2500000]}, 3000000, (error, txos) => {
      if (txos) {
        resps = resps.concat(txos)
      }
      //respond(req, res, error, txos)
      if (error) {
        console.log(n++, inspect(error.message), height)
      }
    })
    setTimeout(() => respond(req, res, null, resps), 1000)

    // add confirmations to utxos
    /*parallel({
      tip: (cb) => adapter.tips(cb),
      txos: (cb) => adapter.transactionIdsByScriptRange({scId, heightRange: [0, 0xFFFFFFFF]}, 440, cb)
    }, (err, results) => {
      if (err) return respond(req, res, err)

      let tipHeight = results.tip.txo.height
      let txos = []
      console.log(result.txos)

      Object.keys(results.txos).forEach(function (key) {
        let txo = results.txos[key]
        let height = utxo.height
        if (height && height <= tipHeight) {
          txo.confirmations = tipHeight - height + 1
        } else {
          txo.confirmations = 0
        }

        // we don't care about the scId
        delete utxo.scId

        txos.push(txo)
      })
      respond(req, res, null, txos)
    })*/
  })

  router.get('/a/:address/txs', (req, res) => {
    let scId
    try {
      scId = addressToScriptId(req.params.address)
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)
    let verbose = req.query.verbose ? true : false

    adapter.transactionIdsByScriptRange({scId, heightRange: [1, 0xffffffff]}, 440, (err, txIdSet) => {
      if (err) return respond(req, res, err)

      let tasks = {}
      for (let txId in txIdSet) {
        tasks[txId] = (next) => rpc('getrawtransaction', [txIdSet[txId], verbose], next)
      }

      parallel(tasks, (err, result) => respond(req, res, err, result))
    })
  })

  router.get('/a/:address/balance', (req, res) => {
    let scId
    try {
      scId = addressToScriptId(req.params.address)
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)

    adapter.utxosByScriptRange({scId, heightRange: [1, 0xFFFFFFFF]}, 440, (err, results) => {
      if (err) return respond(req, res, err)

      respond(req, res, null, results.reduce((p, x) => p + x.value, 0))
    })
  })

  router.get('/a/:address/unconfirmedBalance', (req, res) => {
    let scId
    try {
      scId = addressToScriptId(req.params.address)
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)

    parallel({
      tip: (cb) => adapter.tips(cb),
      utxos: (cb) => adapter.utxosByScriptRange({scId, heightRange: [1, 0xFFFFFFFF]}, 440, cb)
    }, (err, results) => {
      if (err) return respond(req, res, err)

      let tipHeight = results.tip.txo.height
      let utxos = []

      Object.keys(results.utxos).forEach(function (key) {
        let utxo = results.utxos[key]
        let height = utxo.height
        if (height && height <= tipHeight) {
          utxo.confirmations = tipHeight - height + 1
        } else {
          utxo.confirmations = 0
        }

        // we don't care about the scId
        delete utxo.scId

        utxos.push(utxo)
      })

      respond(req, res, null, utxos.filter(x => x.confirmations === 0).reduce((p, x) => p + x.value, 0))
    })
  })

  router.get('/a/:address/confirmedBalance', (req, res) => {
    let scId
    try {
      scId = addressToScriptId(req.params.address)
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)

    parallel({
      tip: (cb) => adapter.tips(cb),
      utxos: (cb) => adapter.utxosByScriptRange({scId, heightRange: [1, 0xFFFFFFFF]}, 440, cb)
    }, (err, results) => {
      if (err) return respond(req, res, err)

      let tipHeight = results.tip.txo.height
      let utxos = []

      Object.keys(results.utxos).forEach(function (key) {
        let utxo = results.utxos[key]
        let height = utxo.height
        if (height && height <= tipHeight) {
          utxo.confirmations = tipHeight - height + 1
        } else {
          utxo.confirmations = 0
        }

        // we don't care about the scId
        delete utxo.scId

        utxos.push(utxo)
      })

      respond(req, res, null, utxos.filter(x => x.confirmations >0).reduce((p, x) => p + x.value, 0))
    })
  })

  return router
}
