const { USER_CONFIG, APP_CONFIG } = require('../config')

const {
  dateREStrict,
  ymdFormat
} = require('../lib/utils')

const { defaultLogger:logger } = require('../lib/logger')

const id = (...args) => [...args]

const validate = (validateFn, cliCommand) => (...args) => {
  validateFn(...args)
  cliCommand(...args)
}

const validators = {

  query: async function(...args) {

    const [ participantId, options={} ] = args
    const { dateRange, windowSize, refresh } = options

    if (dateRange && dateRange.length > 0) {

      if (windowSize != null) {
        logger.error('Provide a window size or a date range, but not both.')
        process.exit(1)
      }

      if (dateRange.some(date => !dateREStrict.test(date))) {
        const fmt = ymdFormat.toLowerCase()
        logger.error(`invalid date format: ${dateRange.join('..')}.\n\tExpected format: '${fmt}..${fmt}'`)
        process.exit(1)
      }

    } else if (windowSize == null) {

      logger.info(`Using default window size of ${ USER_CONFIG.WINDOW_SIZE } days`)

    } else if (isNaN(windowSize) || windowSize <= 0) {

      logger.error('window size must be non-negative integer')
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
  report: id,
  undefined: (...args) => { throw new Error('no handler defined') }

}

module.exports = { validate, validators }
