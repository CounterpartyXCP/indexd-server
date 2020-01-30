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
  } else if (opts.custom) {
    let params = opts.custom.split('|').map(x => parseInt(x, 16))
    if (params.length !== 2) {
      throw new Error('CUSTOM option must be 2 hex bytes separated with |')
    }
    network = bitcoin.networks.testnet
    // custom networks are regtest networks with certain changes
    network.pubKeyHash = params[0]
    network.scriptHash = params[1]
    networkName = 'custom'
    console.log('Custom network', network)
  }

  let maxResults = 100000
  let chunkSize = 10
  let resultSizeMax = 200
  if (process.env.MAX_ROWS_LEVELDB) {
    try {
      let newMaxResults = parseInt(process.env.MAX_ROWS_LEVELDB)

      if (Number.isNaN(newMaxResults) || !Number.isInteger(newMaxResults) || newMaxResults <= 0) {
        throw new Error('MAX_ROWS_LEVELDB must be a positive non-zero integer')
      } else {
        maxResults = newMaxResults
      }
    } catch(e) {
      console.log('Invalid value for MAX_ROWS_LEVELDB', e)
    }
  }

  // convenience function to search ranges on leveldb
  let searchRange = (fn, scId, cb) => {
    try {
      adapter.tips((err, data) => {
        if (err) {
          cb(err)
          return
        }

        let results = []
        const getChunk = (hs) => {
          let mh = Math.max(hs - chunkSize, 1)
          if (!Number.isFinite(maxResults)) {
            maxResults = 1000 // TODO: find a better fallback
          }

          adapter[fn]({scId, heightRange: [mh, hs], mempool: true}, maxResults, (err, ndata) => {
            if (err) {
              console.log('Error while getting chunk', mh, 'to', hs)
              cb(err, null)
              return
            }
            results = results.concat(ndata)
            if (mh > 1 && results.length < resultSizeMax) {
              setImmediate(() => {
                try {
                  getChunk(mh - 1)
                } catch (e) {
                  console.log('Inner getChunk error', e)
                  if (results.length > 0) {
                    cb(null, results)
                  } else {
                    cb(e, null)
                  }
                }
              })
            } else {
              console.log('Search reached block', mh)
              cb(null, results)
            }
          })
        }

        try {
          console.log('scriptrange search:', data.txo.height, data)
          //adapter[fn]({scId, heightRange: [1, data.txo.height], mempool: true}, maxResults, cb)
          getChunk(data.txo.height)
        } catch (e) {
          console.log('searchRange, after tips!', e)
          cb(e, null)
        }
      })
    } catch (e) {
      console.log('searchRange, before tips!', e)
      cb(e, null)
    }
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
      console.log('utxos:', req.params.address)
      scId = addressToScriptId(req.params.address)
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)

    // add confirmations to utxos
    parallel({
      tip: (cb) => {
        try {
          return adapter.tips(cb)
        } catch(e) {
          console.log('Error fetching tips:', e)
          return false
        }
      },
      utxos: (cb) => {
        try {
          return searchRange('utxosByScriptRange', scId, cb)
        } catch (e) {
          console.log(e)
          return false
        }
      }
    }, (err, results) => {
      if (err) return respond(req, res, err)
      if (!results.tip) return respond(req, res, null, {})
      if (!results.utxos) return respond(req, res, null, {})

      let tipHeight = results.tip.txo.height
      let utxos = []

      console.log('Bundling utxos in an array')
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
      console.log('txos:', req.params.address)
      scId = addressToScriptId(req.params.address)
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)

    // add confirmations to utxos
    parallel({
      tip: (cb) => adapter.tips(cb),
      txos: (cb) => {
        try {
          return searchRange('transactionIdsByScriptRange', scId, cb)
        } catch (e) {
          console.log(e)
          return false
        }
      }
    }, (err, results) => {
      if (err) return respond(req, res, err)

      let tipHeight = results.tip.txo.height
      let txos = []

      Object.keys(results.txos).forEach(function (key) {
        let txo = results.txos[key]
        let height = txo.height
        if (height && height <= tipHeight) {
          txo.confirmations = tipHeight - height + 1
        } else {
          txo.confirmations = 0
        }

        // we don't care about the scId
        delete txo.scId

        txos.push(txo)
      })
      respond(req, res, null, txos)
    })
  })

  router.get('/a/:address/txs', (req, res) => {
    let scId
    try {
      console.log('txs:', req.params.address)
      scId = addressToScriptId(req.params.address)
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)
    let verbose = req.query.verbose ? true : false

    searchRange('transactionIdsByScriptRange', scId, (err, txIdSet) => {
      if (err) return respond(req, res, err)

      let tasks = {}
      for (let txId in txIdSet) {
        tasks[txId] = (next) => rpc('getrawtransaction', [txIdSet[txId], verbose], next)
      }

      parallel({
        tip: (cb) => adapter.tips(cb),
        ...tasks
      }, (err, {tip, ...result}) => {
        let txs = []
        let tipHeight = tip.txo.height

        Object.keys(result).map(id => txs.push(result[id]))

        if (!err) {
          if (req.query.verbose > 0) {
            txs = txs.map(tx => ({ height: tipHeight - tx.confirmations, ...tx }))
          }
        }

        if (req.query.page && req.query.per_page) {
          let qpage = parseInt(req.query.page)
          let qperPage = parseInt(req.query.per_page)

          if (!(Number.isNaN(qpage) || Number.isNaN(qperPage)) && (qpage > 0) && (qperPage > 0)) {
            let start = qperPage * (qpage - 1)
            let end = start + qperPage

            txs = {
              txs: txs.slice(start, end), tx_count: txs.length // Pretty innefficient, should slice from the data query
            }
          }
        }

        respond(req, res, err, txs)
      })
    })
  })

  router.get('/a/:address/balance', (req, res) => {
    let scId
    try {
      console.log('balance:', req.params.address)
      scId = addressToScriptId(req.params.address)
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)

    searchRange('utxosByScriptRange', scId, (err, results) => {
      if (err) return respond(req, res, err)

      respond(req, res, null, results.reduce((p, x) => p + x.value, 0))
    })
  })

  router.get('/a/:address/unconfirmedBalance', (req, res) => {
    let scId
    try {
      console.log('unconfirmedBalance:', req.params.address)
      scId = addressToScriptId(req.params.address)
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)

    parallel({
      tip: (cb) => adapter.tips(cb),
      utxos: (cb) => searchRange('utxosByScriptRange', scId, cb)
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
      console.log('confirmedBalance:', req.params.address)
      scId = addressToScriptId(req.params.address)
    } catch (e) { return respond(req, res, e) }

    let height = resolveHeight(req.query.height)

    parallel({
      tip: (cb) => adapter.tips(cb),
      utxos: (cb) => searchRange('utxosByScriptRange', scId, cb)
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
