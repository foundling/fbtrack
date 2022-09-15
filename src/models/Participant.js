const path = require('path')
const FitbitClient = require('fitbit-node')
const { addSeconds, format, parseISO } = require('date-fns')

const {
  dates,
  http,
  io,
  formatters,
  utils
} = require('../lib')

const { defaultLogger:logger } = require('../lib/logger')

const config = require('../config').getConfig({ requiresUserSetup: true })

const {
  APP,
  FITBIT,
  USER,
} = config

const {
  DB_NAME,
  DB_PATH,
  RAW_DATA_PATH,
} = APP

const {
  CLIENT_ID,
  CLIENT_SECRET,
  ENDPOINTS,
} = FITBIT

const { WINDOW_SIZE } = USER

const Database = require('./Database')

const {
  datesWithinBoundaries,
  ymdFormat,
} = dates

const {
  isSuccess,
  invalidRefreshToken,
  rateLimitExceeded,
  accessTokenExpired,
} = http

const {
  getFiles,
  writeFilePromise,
} = io

const db = new Database({ databaseName: DB_NAME })

const fbClient = new FitbitClient({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET
})

class Participant {

  constructor({ files, participantId, record }) {

    this.files = files
    this.participantId = record.participantId
    this.record = record
    this.queryStats = null

  }

  async buildQueryPathsByDate(start, stop) {

    const expectedDates = datesWithinBoundaries(start, stop)
    const filenames = await getFiles({
      directory: RAW_DATA_PATH,
      criterion: fname => fname.startsWith(this.participantId) &&
                          expectedDates.some(d => fname.includes(format(d, ymdFormat))),
    })

    const missingMetricsByDate = await this.findUncapturedDates({
      filenames,
      expectedDates,
      metrics: [...ENDPOINTS.keys()],
    })

    const allDatesCollected = [...missingMetricsByDate.values()].every(metricsForDate => metricsForDate.size === 0)

    if (allDatesCollected) {
      console.log(`All dates captured for participant ${this.participantId} in this date range.`)
      return new Map()
    }

    return this.generateQueryPathsByDate({
      metricsByDate: missingMetricsByDate,
      endpoints: ENDPOINTS,
    })

  }

  async * query(start, stop) {

    const queryPathsByDate = await this.buildQueryPathsByDate(start, stop)

    // map: [ date => [ metric => queryPath ]]
    for (const [date, paths] of queryPathsByDate) {

      if (paths.size === 0) {
        continue
      }

      for (const [metric, queryPath] of paths) {

        let metadata

        try {

          const metricData = await this.queryFitbit(queryPath)
          const filename = this.buildFilename({
            date: date,
            extension: 'json',
            metric,
            participantId: this.participantId,
          })
          const outputPath = path.join(RAW_DATA_PATH, filename)

          await writeFilePromise(outputPath, JSON.stringify(metricData))

          metadata = {
            collected: true,
            date,
            error: null,
            metric,
            participantId: this.participantId,
          }

        } catch(e) {

          // log to disk and store errors in collection progress stats
          logger.error(`query error for ${participantId}: query for ${metric} data on ${date} failed:\n${ e }`)

          metadata = {
            collected: false,
            date,
            error: 'fail',
            metric,
            participantId: this.participantId,
          }

        }

        yield metadata

      }

    }

  }

  async queryFitbit(queryPath) {

    /*
     * Error handling of unexpected events is handled in caller. 
     * Refreshing access token, rate limiting handled here.
     */
    const [ body, response ] = await fbClient.get(queryPath, this.record.accessToken)

    if (isSuccess(response)) {

      return body

    }

    if (accessTokenExpired(body)) {

      // this should go to a file
      //logger.info(`queryFitbit - accessToken expired for participant ${this.participantId} ... refreshing`);
      await this.refreshAccessToken()

      const [ retryBody, retryResponse ] = await fbClient.get(queryPath, this.record.accessToken)

      return retryBody

    }

    if (rateLimitExceeded(response)) {

      const leeway = 60
      const secondsToWait = parseInt(response.headers['retry-after']) + leeway
      const resumeTime = format(addSeconds(new Date(), secondsToWait), 'hh:mm')

      // this should go to stdout
      logger.warn(`queryFitbit error for participant ${this.participantId} - rate limit exceeded.`)
      logger.warn(`Waiting ${secondsToWait/60} minutes to resume ... Starting again at ${resumeTime}.\n`)

      await utils.sleep(secondsToWait + leeway)

      const [ retryBody, retryResponse ] = await fbClient.get(queryPath, this.record.accessToken)

      return retryBody

      //logger.error(`queryFitbit error: retry after rateLimitExceeded has failed: ${e}`)
      //throw e

    }

    if (invalidRefreshToken(response)) {

      logger.error(`queryFitbit - InvalidRefreshToken Error for participant ${this.participantId}.`)
      logger.error('The participant needs to be re-authorized with the application.')
      logger.error(`skipping participant ${this.participantId}.`)

      throw new Error(`invalid refresh token for participant ${this.participantId}`)

    }
    
    // what to do here?
    return body

  }

  async refreshAccessToken() {

    try {

      const tokenExpiresIn = 3600
      const { access_token, refresh_token } = await fbClient.refreshAccessToken(
        this.record.accessToken,
        this.record.refreshToken,
        tokenExpiresIn
      )

      await db.init()
      await db.updateAccessTokensById({
        participantId: this.participantId,
        accessToken: access_token,
        refreshToken: refresh_token,
      })

      this.record = await db.getParticipantById(this.participantId)

    } catch(e) {

      logger.error(`Error - attempt to refresh Access Token failed: ${e}`)

    }
  }

  buildFilename({ participantId, date, metric, extension='json'}) {

    return `${participantId}_${date}_${metric}.json`

  }

  generateQueryPathsByDate({ metricsByDate, endpoints }) {

    const memo = new Map()

    for (const [date, metricToTemplatePathMap] of metricsByDate) {

      if (!memo.has(date)) {
        memo.set(date, new Map())
      }

      for (const [metric, templatePathMap] of metricToTemplatePathMap) {

        const populatedTemplate = endpoints.get(metric).replace('%DATE%', date)
        memo.get(date).set(metric, populatedTemplate)

      }
    }

    return memo

  }

  async findUncapturedDates({ filenames, expectedDates, metrics }) {

    const missing = new Map()

    for (const date of expectedDates) {

      const formattedDate = format(date, ymdFormat) 
      missing.set(formattedDate, new Map())

      for (const metric of metrics) {
        missing.get(formattedDate).set(metric, true)
      }

    }


    // unfortunately, we need to go from formatted dates in filename back to date objects 
    // so we find the map key that matches our filename date stamp when formatted properly

    for (const filename of filenames) {
      const [ id, dateString, metric, extension ] = filename.split(/[._]/)
      const matchingDate = [...missing.keys()].find(ds => ds === dateString)
      missing.get(matchingDate).delete(metric)
    }

    return missing

  }

}

module.exports = exports = Participant
