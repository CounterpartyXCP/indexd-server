// dotenv at CONFIG_FILE or .env
let dotenv = require('dotenv')
require('dotenv').load({path: process.env.CONFIG_FILE ? process.env.CONFIG_FILE : '.env'})

let TESTNET = (process.env.TESTNET === '1' || (process.env.TESTNET && process.env.TESTNET.toLowerCase() === 'true'))
let REGTEST = (process.env.REGTEST === '1' || (process.env.REGTEST && process.env.REGTEST.toLowerCase() === 'true'))

if (TESTNET && REGTEST) {
  throw new Error('Cannot specify REGTEST and TESTNET at the same time')
}

let debug = require('debug')('index')
let express = require('express')

let service = require('./lib/service')
let api = require('./lib/express')

let app = express()

let cors = require('cors')
if (process.env.CORS === '*') {
  app.use(cors())
} else if (process.env.CORS) {
  app.use(cors({ origin: process.env.CORS }))
}

// run the service
debug(`Initializing blockchain connection${["", " (for testnet)", " (for regtest)"][(TESTNET?1:0)+(REGTEST?2:0)]}`)
service((err, adapter) => {
  if (err) {
    return debug('Initialization failed:', err)
  }

  // start the API server
  debug('starting API server')
  app.use(api(adapter, {testnet: TESTNET, regtest: REGTEST}))
  app.listen(process.env.SERVER_PORT);
  debug("App listening on port "+process.env.SERVER_PORT);
})
