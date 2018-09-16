let indexd = require('indexd')
let leveldown = require('leveldown')
let qup = require('qup')
let rpc = require('./rpc')
let zmq = require('zmq')

let debug = require('debug')('service')
let debugZmq = require('debug')('zmq')
let debugZmqTx = require('debug')('zmq:tx')
let debugZmqBlock = require('debug')('zmq:block')


module.exports = function initialize (callback) {
  function errorSink (err) {
    if (err) debug(err)
  }

  debug(`Init leveldb @ ${process.env.INDEXDB}`)
  let db = leveldown(process.env.INDEXDB)
  let adapter = indexd.makeAdapter(db, rpc)

  db.open({
    writeBufferSize: 1 * 1024 * 1024 * 1024
  }, (err) => {
    if (err) return callback(err, adapter)
    debug(`Opened leveldb @ ${process.env.INDEXDB}`)

    let syncQueue = qup((_, next) => {
      indexd.resync(rpc, adapter, (err) => {
        if (err) return next(err)
        adapter.mempool.reset(next)
      })
    }, 1)

    let zmqSock = zmq.socket('sub')
    zmqSock.connect(process.env.ZMQ)
    zmqSock.subscribe('hashblock')
    zmqSock.subscribe('hashtx')

    let lastSequence = {}
    zmqSock.on('message', (topic, message, sequence) => {
      topic = topic.toString('utf8')
      message = message.toString('hex')
      sequence = sequence.readUInt32LE()

      // if any ZMQ messages were lost,  assume a resync is required
      if (lastSequence[topic] !== undefined && (sequence !== (lastSequence[topic] + 1))) {
        debugZmq(`${sequence - lastSequence - 1} messages lost`)
        lastSequence[topic] = sequence
        return syncQueue.push(null, errorSink)
      }
      lastSequence[topic] = sequence

      // resync every block
      if (topic === 'hashblock') {
        debugZmqBlock(topic, message)
        return syncQueue.push(null, errorSink)
      }

      // add every tx to the mempool
      if (topic === 'hashtx') {
        // don't add to the mempool until after a reset is complete
        if (syncQueue.running > 0) {
          debugZmqTx('Got hashtx but sync job is running')
          return
        }

        debugZmqTx(topic, message)
        adapter.mempool.add(message, errorSink)
      }
    })

    syncQueue.push(null, errorSink)
    callback(null, adapter)
  })
}
