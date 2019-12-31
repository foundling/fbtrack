require('dotenv').config()

const { 
  LOGS_PATH,
  DEFAULT_WINDOW_SIZE
} = process.env

const Logger = require('./logger')
const logger = new Logger({
  logDir: LOGS_PATH,
  config: {
    info: false,
    warn: false,
    error: false,
    success: false
  }
})


const id = (...args) => [...args]

const validate = (validateFn, cliCommand) => (...args) => {
  validateFn(...args)
  cliCommand(...args)
}

const validators = {

  query: async function(args) {

    const [ participantId, options={} ] = args
    const { dates=[], windowSize=3, refresh=false } = options

    // participantId, { dates=[], windowSize = null, refresh=false } = {}) {
    // both window size and range, invalid

    if (dates.length > 0 && windowSize !== null) {
      await logger.error('Provide a window size or a date range, but not both.')
      process.exit(1)
    }

    // check dates for validity
    if (!dates.every(date => dateRE.test(date))) {
      await logger.error(`invalid date format: ${dates.join('..')}`)
      process.exit(1)
    }

    // if both values are missing, set default window size
    if (!dates.length && windowSize == null) {
      await logger.warning(`no date range provided, no window size provided. using default window size of ${ DEFAULT_WINDOW_SIZE } days`)
    }

    // dates, windowSize, refresh } ]
    return [ participantId, options ]

  },

  signup: id,
  revoke: id,
  missing: id,
  status: id,
  apistatus: id,
  update: id,
  dump: id,
  undefined: (...args) => { throw new Error('no handler defined') }

}

module.exports = { validate, validators }
