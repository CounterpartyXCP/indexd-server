let debug = require('debug')('express')
let bitcoin = require('bitcoinjs-lib')
let bodyParser = require('body-parser')
let express = require('express')
let parallel = require('run-parallel')
let rpc = require('./rpc')
let types = require('indexd/types')
let BN = require('bn.js')

function Hex256bit (value) {
  return typeof value === 'string' &&
    /^([0-9a-f]{2})+$/i.test(value) &&
    value.length === 64
}

module.exports = function initialize (adapter, opts) {
  let router = new express.Router()
  let network = opts.testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin

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
      localtip: (cb) => adapter.blockchain.db.get(types.tip, {}, cb),
      bitcoinheight: (cb) => rpc('getblockcount', [], cb)
    }, (err, results) => {
      if (err) return respond(req, res, err)

      let localheight = results.localtip ? results.localtip.height : 0
      let bitcoinheight = results.bitcoinheight
      status = {
        chainBlock: bitcoinheight,
        indexBlock: localheight,
        blocksBehind: (bitcoinheight && localheight) ? (bitcoinheight - localheight) : null,
        ready: bitcoinheight && localheight && (bitcoinheight - localheight) <= 1,
      }

      respond(req, res, null, status)
    })
  })

  router.get('/a/:address/utxos', (req, res) => {
    let scId
    try {
      let script = bitcoin.address.toOutputScript(req.params.address, network)
      scId = bitcoin.crypto.sha256(script).toString('hex')
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)

    // add confirmations to utxos
    parallel({
      tip: (cb) => adapter.blockchain.db.get(types.tip, {}, cb),
      utxos: (cb) => adapter.utxosByScriptId(scId, height, cb)
    }, (err, results) => {
      if (err) return respond(req, res, err)

      let tipHeight = results.tip.height
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

  router.get('/a/:address/balance', (req, res) => {
    let scId
    try {
      let script = bitcoin.address.toOutputScript(req.params.address, network)
      scId = bitcoin.crypto.sha256(script).toString('hex')
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)

    parallel({
      tip: (cb) => adapter.blockchain.db.get(types.tip, {}, cb),
      utxos: (cb) => adapter.utxosByScriptId(scId, height, cb)
    }, (err, results) => {
      if (err) return respond(req, res, err)

      let tipHeight = results.tip.height
      let balance = {
        confirmed: new BN('0', 16),
        unconfirmed: new BN('0', 16)
      }

      Object.keys(results.utxos).forEach(function (key) {
        let utxo = results.utxos[key]
        let height = utxo.height
        if (height && height <= tipHeight) {
          balance.confirmed.iadd(new BN(utxo.value))
        } else {
          balance.unconfirmed.iadd(new BN(utxo.value))
        }
      })
      respond(req, res, null, {
        confirmed: balance.confirmed.toString(10),
        unconfirmed: balance.unconfirmed.toString(10)
      })
    })
  })

  router.get('/a/:address/txs', (req, res) => {
    let scId
    try {
      let script = bitcoin.address.toOutputScript(req.params.address, network)
      scId = bitcoin.crypto.sha256(script).toString('hex')
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)
    let verbose = req.query.verbose ? true : false

    adapter.transactionIdsByScriptId(scId, height, (err, txIdSet) => {
      if (err) return respond(req, res, err)

      let tasks = {}
      for (let txId in txIdSet) {
        tasks[txId] = (next) => rpc('getrawtransaction', [txId, verbose], next)
      }

      parallel(tasks, (err, result) => respond(req, res, err, result))
    })
  })

  return router
}
