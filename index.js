// dotenv at CONFIG_FILE or .env
let dotenv = require('dotenv')
require('dotenv').load({path: process.env.CONFIG_FILE ? process.env.CONFIG_FILE : '.env'})

let TESTNET = (process.env.TESTNET === '1' || process.env.TESTNET.toLowerCase() === 'true')

let debug = require('debug')('index')
let express = require('express')

let service = require('./lib/service')
let api = require('./lib/express')

let app = express()

// run the service
debug(`Initializing blockchain connection${TESTNET ? " (for testnet)" : ""}`)
service((err, adapter) => {
  if (err) {
    return debug('Initialization failed:', err)
  }

  // start the API server
  debug('starting API server')
  app.use(api(adapter, {testnet: TESTNET}))
  app.listen(process.env.SERVER_PORT);
  debug("App listening on port "+process.env.SERVER_PORT);
})
