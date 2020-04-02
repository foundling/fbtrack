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

const { WINDOW_SIZE } = USER_CONFIG

const {
  CLIENT_ID,
  CLIENT_SECRET,
  ENDPOINTS
} = FITBIT_CONFIG

const {
  DB_NAME,
  DB_PATH,
  RAW_DATA_PATH,
  LOGS_PATH,
} = APP_CONFIG

const Database = require(DB_PATH)

const {
  datesFromRange,
  dateRangeFromDateStrings,
  dateRE,
  ymdFormat,
} = dates

const {
  isServerError,
  isSuccess,
  invalidRefreshToken,
  invalidAccessToken,
  rateLimitExceeded,
  accessTokenExpired,
} = http

const {
  getFiles,
  readdirPromise,
  writeDatasetToDisk,
  writeFilePromise,
} = io

const db = new Database({
  databaseFile: DB_NAME
})

const fbClient = new FitbitClient({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET
})

function generateQueryPathsByDate({ metricsByDate, endpoints }) {

  const memo = {}

  for (const dateString in metricsByDate) {

    if (!memo[dateString]) {
      memo[dateString] = {}
    }

    for (const metric in metricsByDate[dateString]) {

      memo[dateString][metric] = endpoints[metric].replace('%DATE%', dateString)

    }
  }

  return memo

}

async function queryFitbit(queryPath) {

  const [ body, response ] = await fbClient.get(queryPath, participant.accessToken)

  if (isSuccess(response)) {
    return body
  }

  if (accessTokenExpired(response)) {

    try {
      const { access_token:accessToken, refresh_token:refreshToken } = await refreshAccessToken({
        participantId: participant.participantId,
        accessToken: participant.accessToken,
        refreshToken: participant.refreshToken
      })
    } catch(e) {
      if (e.status === 400 && e.context.errors[0].errorType === 'invalid_grant') {
        logger.error(`Failed to refresh participant ${this.participantId}'s Refresh Access Token.`)
        return
      }
    }

    // warning: if this fails, you will have to re-auth the subject. important!
    await db.updateAccessTokensById({
      participantId: participant.participantId,
      accessToken,
      refreshToken
    })

    const [ retryBody, retryResponse ] = await fbClient.get(queryPath, accessToken)
    return retryBody

  }

  if (rateLimitExceeded(response)) {

    const leeway = 60
    const secondsToWait = parseInt(response.headers['retry-after']) + leeway
    const resumeTime = format(addSeconds(new Date(), secondsToWait), 'hh:mm')

    logger.error(`Rate limit exceeded. Waiting ${secondsToWait} seconds to resume`)
    logger.error(`Starting againt at ${resumeTime}.`)

    await utils.sleep(secondsToWait + leeway)

    const [ retryBody, retryResponse ] = await fbClient.get(queryPath, participant.accessToken)

    return retryBody

  }

  if (invalidRefreshToken(response)) {

    // warning: this is bad news, and annoying to deal with. 
    // make sure database never can't accept bad data for an auth token.
    logger.error(`InvalidRefreshToken Error for participant ${participantId}.`)
    logger.error('The participant needs to be re-authorized with the application.')
    logger.error(`skipping participant ${participantId}.`) 

    return

  }

}

async function findUncapturedDates({ filenames, expectedDateStrings, metrics }) {

  const missing = {}
  for (const dateString of expectedDateStrings) {
    missing[dateString] = metrics.reduce((o, metric) => {
      o[metric] = true;
      return o
    }, {}) 
  }

  for (const filename of filenames) {
    const [ id, dateString, metric, extension ] = filename.split(/[._]/)
    delete missing[dateString][metric]
  }

  return missing

}

async function refreshAccessToken({ accessToken, refreshToken, participantId }) {

  const expirationWindow = 3600

  return await fbClient.refreshAccessToken(accessToken, refreshToken, expirationWindow)

}

class Participant {

  constructor({ participantId, files, record }) {

    this.files = files
    this.participantId = record.participantId
    this.record = record

  }
  
  async buildQueryPathsByDate(start, stop) {

    const expectedDateStrings = datesFromRange({ start, stop }).map(d => format(d, ymdFormat))

    const filenames = await getFiles({
      directory: RAW_DATA_PATH,
      criterion: fname => fname.startsWith(this.participantId) && expectedDateStrings.some(s => fname.includes(s)),
    })

    const missingMetricsByDate = await findUncapturedDates({
      filenames,
      expectedDateStrings,
      metrics: Object.keys(ENDPOINTS),
    })

    const allDataCaptured = Object.entries(missingMetricsByDate)
      .every(metricsByDate => Object.entries(metricsByDate).length === 0)

    if (allDataCaptured) {
      await logger.info(`All dates captured for participant ${participantId} in this date range.`) 
      return
    }

    return generateQueryPathsByDate({
      metricsByDate: missingMetricsByDate,
      endpoints: ENDPOINTS
    })

  }

  buildMetricFilename({ participantId, date, metric, extension='json'}) {
    return `${participantId}_${date}_${metric}.json` 
  }

  async query(start, stop) {

    const objectIsEmpty = o => Object.entries(o).length === 0
    const queryPathsByDate = await this.buildQueryPathsByDate(start, stop)

    for (const [date, paths] of queryPathsByDate.entries()) {

      console.log(`DATE: ${date}`)

      if (objectIsEmpty(paths)) {
        logger.info(`All data for participant ${this.participantId} in window has been retrieved.`)
        continue
      }

      for (const [metric, path] of paths.entries()) {
        const metricData = await queryFitbit(path)
        const outputPath = path.join(
          RAW_DATA_PATH,
          this.buildMetricFilename({ participantId, date, metric, extension: 'json' })
        )
        await writeFilePromise(outputPath, JSON.stringify(metricData))
        console.log(`${metric} ✓`)
      }

    }

  }

}

module.exports = Participant
