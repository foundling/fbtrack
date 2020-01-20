const { USER_CONFIG, APP_CONFIG } = require('../config')

const {
  dates
} = require('../lib/utils')

const {
  dateREStrict,
  ymdFormat
} = dates

const { defaultLogger:logger } = require('../lib/logger')

const id = (...args) => [...args]

const validate = (validateFn, cliCommand) => (...args) => {
  validateFn(...args)
  cliCommand(...args)
}

const validators = {

  apistatus: id,
  configure: id,
  query: async function(...args) {

    const [{ all, participantIds, dateRange, windowSize, refresh }] = args

    if (!all && !participantIds) {
      logger.error('Please provide at least one participant id')
      process.exit(1)
    }

    if (all && participantIds) {
      logger.error('Please provide one ore more participantIds or use the -a, -all flag, but not both.')
      process.exit(1)
    }

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

  report: id,
  schedule: id,
  signup: id,
  undefined: (...args) => { throw new Error('no handler defined') }

}

module.exports = { validate, validators }
