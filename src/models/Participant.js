const path = require('path')
const FitbitClient = require('fitbit-node')
const { addSeconds, format } = require('date-fns')

const { defaultLogger: logger } = require('../lib/logger')
const { dates, http, io, formatters, utils } = require('../lib/utils')
const config = require('../config').getConfig({ requiresUserSetup: true })

const {
  APP_CONFIG,
  FITBIT_CONFIG,
  USER_CONFIG,
} = config

const {
  DB_NAME,
  DB_PATH,
  RAW_DATA_PATH,
} = APP_CONFIG

const {
  CLIENT_ID,
  CLIENT_SECRET,
  ENDPOINTS,
} = FITBIT_CONFIG

const { WINDOW_SIZE } = USER_CONFIG

const Database = require(DB_PATH)

const {
  datesFromRange,
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

const db = new Database({
  databaseFile: DB_NAME
})

const fbClient = new FitbitClient({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET
})

class Participant {

  constructor({ files, participantId, record }) {

    this.files = files
    this.participantId = record.participantId
    this.record = record

  }
 
  async buildQueryPathsByDate(start, stop) {

    const expectedDateStrings = datesFromRange({ start, stop }).map(d => format(d, ymdFormat))

    const filenames = await getFiles({
      directory: RAW_DATA_PATH,
      criterion: fname => fname.startsWith(this.participantId) &&
                          expectedDateStrings.some(s => fname.includes(s)),
    })

    const missingMetricsByDate = await this.findUncapturedDates({
      filenames,
      expectedDateStrings,
      metrics: [...ENDPOINTS.keys()],
    })

    const noMissingDataForDates = [...missingMetricsByDate.values()].every(metricsForDate => metricsForDate.size === 0)

    if (noMissingDataForDates) {
      console.log(`All dates captured for participant ${this.participantId} in this date range.`)
      return new Map()
    }

    return this.generateQueryPathsByDate({
      metricsByDate: missingMetricsByDate,
      endpoints: ENDPOINTS,
    })

  }

  async query(start, stop) {

    const queryPathsByDate = await this.buildQueryPathsByDate(start, stop)

    const collected = new Map()
    for (const [date, paths] of queryPathsByDate) {

      collected.set(date, new Map())

      //console.log(`\n Date: ${date}\n`)

      if (paths.size === 0) {
        //console.log(`  All metrics have been captured for date ${date}.`)
        continue
      }

      for (const [metric, queryPath] of paths) {

        const metricData = await this.queryFitbit(queryPath)
        if (!metricData) {
          continue;
        }

        const filename = this.buildFilename({ participantId: this.participantId, date, metric, extension: 'json' })
        const outputPath = path.join(RAW_DATA_PATH, filename)

        await writeFilePromise(outputPath, JSON.stringify(metricData))

        collected.get(date).set(metric, true)

      }

    }

    return collected
    //console.log('\n')

  }

  async queryFitbit(queryPath) {

    let body
    let response

    try {

      [ body, response ] = await fbClient.get(queryPath, this.record.accessToken)

    } catch(e) {

      logger.error(`attempt to query Fitbit failed:\n${e}`)
      throw e

    }

    if (isSuccess(response)) {

      return body

    }

    if (accessTokenExpired(body)) {

      logger.info(`queryFitbit - accessToken expired for participant ${this.participantId} ... refreshing`);
      await this.refreshAccessToken()

      try {

        const [ retryBody, retryResponse ] = await fbClient.get(queryPath, this.record.accessToken)
        return retryBody

      } catch(e) {

        logger.error(`queryFitbit - query after refreshAccessToken has failed: ${e}`)
        throw e

      }

    }

    if (rateLimitExceeded(response)) {

      const leeway = 60
      const secondsToWait = parseInt(response.headers['retry-after']) + leeway
      const resumeTime = format(addSeconds(new Date(), secondsToWait), 'hh:mm')

      logger.error(`queryFitbit error for participant ${this.participantId} - rate limit exceeded.`)
      logger.error(`Waiting ${secondsToWait/60} minutes to resume ... Starting again at ${resumeTime}.\n`)

      await utils.sleep(secondsToWait + leeway)

      try {

        const [ retryBody, retryResponse ] = await fbClient.get(queryPath, this.record.accessToken)
        return retryBody

      } catch(e) {

        logger.error(`queryFitbit error: retry after rateLimitExceeded has failed: ${e}`)
        throw e

      }

    }

    if (invalidRefreshToken(response)) {

      // warning: this is bad news, and annoying to deal with.
      // make sure database never can't accept bad data for an auth token.
      logger.error(`queryFitbit - InvalidRefreshToken Error for participant ${this.participantId}.`)
      logger.error('The participant needs to be re-authorized with the application.')
      logger.error(`skipping participant ${this.participantId}.`)

      return

    }

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

    // 'metricToTemplatePathMap' is an example of where an explicit type system could
    // liberate you from the ugly naming
    const memo = new Map()

    for (const [dateString, metricToTemplatePathMap] of metricsByDate) {

      if (!memo.has(dateString)) {
        memo.set(dateString, new Map())
      }

      for (const [metric, templatePathMap] of metricToTemplatePathMap) {

        const populatedTemplate = endpoints.get(metric).replace('%DATE%', dateString)
        memo.get(dateString).set(metric, populatedTemplate)

      }
    }

    return memo

  }

  async findUncapturedDates({ filenames, expectedDateStrings, metrics }) {

    const missing = new Map()

    for (const dateString of expectedDateStrings) {
      missing.set(dateString, new Map())
      for (const metric of metrics) {
        missing.get(dateString).set(metric, true)
      }
    }


    for (const filename of filenames) {
      const [ id, dateString, metric, extension ] = filename.split(/[._]/)
      missing.get(dateString).delete(metric)
    }

    return missing

  }

}

module.exports = exports = Participant
