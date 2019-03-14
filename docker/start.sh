#!/bin/bash

cd /indexd

if [ ! -f ./node_modules/bitcoinjs-lib/package.json ]; then
  echo "No nodejs modules installed, installing"
  npm install
fi

if [ ! -f ./.env ]; then
  cp .env-example .env
fi

/usr/bin/forever ./index.js
