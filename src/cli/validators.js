require('dotenv').config()

const { 
  LOGS_PATH,
  DEFAULT_WINDOW_SIZE
} = process.env

const {
  dateRE,
  ymdFormat
} = require('./utils')

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

  query: async function(...args) {

    const [ participantId, options={} ] = args
    const { dates, windowSize, refresh } = options

    if (dates && dates.length > 0) {

      if (windowSize != null) {
        await logger.error('Provide a window size or a date range, but not both.')
        process.exit(1)
      }

      if (dates.some(date => !dateRE.test(date))) {
        await logger.error(`invalid date format: ${dates.join('..')}. Expected format: ${ymdFormat}`)
        process.exit(1)
      }

    } else if (windowSize == null) {

      await logger.info(`Using default window size of ${ DEFAULT_WINDOW_SIZE } days`)

    } else if (isNaN(windowSize) || windowSize < 0) {

      await logger.error('window size must be non-negative integer')
      process.exit(1)

    }


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
