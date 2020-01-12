const { Logger, defaultLogger } = require('./logger')

const tape = require('tape')
const { default: tapePromise } = require('tape-promise')

const test = tapePromise(tape)
