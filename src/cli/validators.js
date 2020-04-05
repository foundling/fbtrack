const { USER_CONFIG, APP_CONFIG } = require('../config').getConfig();
const windowSize = USER_CONFIG.WINDOW_SIZE;


const dates = require('../lib/dates')
const { defaultLogger: logger } = require('../lib/logger')

const {
  dateREStrict,
  ymdFormat
} = dates

const id = (...args) => [...args]

const validate = (validateFn, cliCommand) => (...args) => {
  validateFn(...args)
  cliCommand(...args)
}

const validators = {

  apistatus: id,
  configure: id,
  query: async function(...args) {

    const [{ all, chunkSize=APP_CONFIG.CHUNK_SIZE, participantIds, dateRange, windowSize, refresh }] = args

    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      logger.error('-n, --chunk-size requires a non-negative integer argument.')
      process.exit(1)
    }

    if (participantIds && participantIds.length >= 1 && participantIds.includes('-a')) {
      logger.error('-a flag and -p are exclusive.  use -a for all participants, or -p for specific participant ids, but not both.')
      process.exit(1)
    }

    if (!all && !participantIds) {
      logger.error('Please provide at least one participant id or use the -a flag for all participants.')
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

      logger.info(`No date range or window flag passed. Using default window size of ${ WINDOW_SIZE } days`)

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
