const fs = require('fs')
const path = require('path')
const FitbitClient = require('fitbit-node')
const {
  addDays,
  addSeconds,
  differenceInDays,
  format,
  parseISO,
  subDays
} = require('date-fns')

const {

  FITBIT_CONFIG,
  APP_CONFIG,
  USER_CONFIG,

} = require('../config')

const {
  CLIENT_ID,
  CLIENT_SECRET,
  ENDPOINTS
} = FITBIT_CONFIG

const { WINDOW_SIZE } = USER_CONFIG

const {
  DB_NAME,
  DB_PATH,
  RAW_DATA_PATH,
  LOGS_PATH,
} = APP_CONFIG

const Database = require(DB_PATH)
const { defaultLogger: logger } = require('../lib/logger')
const { dates, http, io, formatters } = require('../lib/utils')

const makeList = formatters.listFormatter('•')

async function sleep(s) {

  function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  await timeout(s * 1000);

}

const {
  datesFromRange,
  dateRangeFromWindowSize,
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
  writeDatasetsToFiles,
  writeFilePromise,
} = io

const db = new Database({
  databaseFile: DB_NAME
})

const fbClient = new FitbitClient({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET
})

async function main({ participantIds=[], all=false, dateRange=[], windowSize=null, refresh=false }) {

  if (dateRange.length === 0 && windowSize == null) {
    windowSize = WINDOW_SIZE
  }

  await db.init()

  /* 
   * participants determined by flag, or by array of ids. these options are exclusive and we 
   * want to announce invalid ids up front
   */ 

  const allParticipants = await db.getParticipants({ active: true })
  const targetParticipants = all ? allParticipants :
                                   allParticipants.filter(participant => participantIds.includes(participant.participantId))

  /* find invalid participants */
  const targetParticipantIdMap = targetParticipants.reduce((memo, participant) => {
    memo[participant.participantId] = true
    return memo
  }, {})
  const invalidParticipantIds = participantIds.filter(id => !targetParticipantIdMap[id])
  if (invalidParticipantIds.length > 0) {
    const invalidList = makeList(invalidParticipantIds)
    await logger.error(
      `The following subject ids were provided but are not in the database. Have they been registered?\n${invalidList}`
    )
  }

  /* query missing days for each participant */
  const today = new Date()
  for (const participant of targetParticipants) {

    const { participantId, registrationDate } = participant

    if (differenceInDays(today, parseISO(registrationDate)) === 0) {
      await logger.info(`Subject ${ participantId } was signed up today. No data to query.`)
      return
    }

    const [ start, stop ] = windowSize ?
      dateRangeFromWindowSize({ registrationDate: new Date(registrationDate), today, windowSize }) :
      dateRangeFromDateStrings({ dates: dateRange })
    const expectedDateStrings = datesFromRange({ start, stop }).map(d => format(d, ymdFormat))

    const filenames = await getFiles({
      directory: RAW_DATA_PATH,
      criterion: fname => fname.startsWith(participantId) && expectedDateStrings.some(dateString => fname.includes(dateString)),
    })

    // missing metrics by date
    const missingMetricsByDate = await findUncapturedDates({
      filenames,
      expectedDateStrings,
      metrics: Object.keys(ENDPOINTS),
    })

    console.log(missingMetricsByDate)
    process.exit()

    const allDataCaptured = Object.keys(missingMetricsByDate).map(date => Boolean(missingMetricsByDate[date])).length === 0
    if (allDataCaptured) {
      await logger.info(`All dates captured for participant ${participantId} in this date range.`) 
      break
    }

    const queryPathsByDate = generateQueryPathsByDate({
      metricsByDate: missingMetricsByDate,
      endpoints: ENDPOINTS
    })

    const datasets = await queryFitbit({
      participant, 
      queryPathsByDate,
    })

    await writeDatasetsToFiles({ 
      datasets,
      participantId, 
      outputDir: RAW_DATA_PATH,
      log: false,
    })

    logger.info(`All data for dates queried was written to ${RAW_DATA_PATH}.`)

  }

}

function isValidDataset(day) {
  return !!day['activities-heart-intraday'].dataset.length
}

function isDataResponse(day) {
  return day.some(metric => metric[0]['activities-heart-intraday'])
}


function generateQueryPathsByDate({ metricsByDate, endpoints }) {

  //TODO: dateStrings will become an object w/ top level keys of dateStrings that point to metrics then to endpoints,
  // { datestring => metric => path }
  // that actually lines up with what's going on here, can you use the metrics in the obj passed in, instead of 
  // referring to the imported enum-like list?

  /* creates a nested map of date strings to metrics to endpoints for those metrics */

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

async function queryFitbit({ participant, queryPathsByDate }) {

  console.log(`PARTICIPANT: ${participant.participantId}`)

  const collectedData = {}
  for (const date in queryPathsByDate) {

    console.log(`DATE: ${date}`)

    collectedData[date] = {}
    const queriesForDate = queryPathsByDate[date]

    for (const metric in queriesForDate) {
      const queryPath = queriesForDate[metric]

      try {

        const [ body, response ] = await fbClient.get(queryPath, participant.accessToken)

        if (isSuccess(response)) {

          console.log(`${metric} ✓`)
          collectedData[date][metric] = body

        } else {

          if (accessTokenExpired(response)) {

            const { access_token:accessToken, refresh_token:refreshToken } = await refreshAccessToken({
              participantId: participant.participantId,
              accessToken: participant.accessToken,
              refreshToken: participant.refreshToken
            })

            // warning: if this fails, you will have to re-auth the subject. important!
            await db.updateAccessTokensById({
              participantId: participant.participantId,
              accessToken,
              refreshToken
            })

            const [ retryBody, retryResponse ] = await fbClient.get(queryPath, accessToken)
            collectedData[date][metric] = retryBody
            console.log(`${metric} ✓`)

          } else if (rateLimitExceeded(response)) {

            const leeway = 60
            const secondsToWait = parseInt(response.headers['retry-after']) + leeway
            const resumeTime = format(addSeconds(new Date(), secondsToWait), 'hh:mm')

            logger.error(`Rate limit exceeded. Waiting ${secondsToWait} seconds to resume. Starting againt at ${resumeTime}.`)
            await sleep(secondsToWait + leeway)

            const [ retryBody, retryResponse ] = await fbClient.get(queryPath, participant.accessToken)
            collectedData[date][metric] = retryBody
            console.log(`${metric} ✓`)

          } else if (invalidRefreshToken(response)) {

            // warning: this is bad news, and annoying to deal with. 
            // make sure database never can't accept bad data for an auth token.
            logger.error(`InvalidRefreshToken Error for participant ${participantId}.`)
            logger.error(`The participant needs to be re-authorized with the application. Please contact Alex.\n Error:\n`)
            logger.error(`skipping participant ${participantId}.`) 

            return
          }

        }

      } catch (e) {

        logger.error(e)

      }
    }

  }

  return collectedData

}

async function findUncapturedDates({ filenames, expectedDateStrings, metrics }) {

  // filenames is what you have, need to check for ALL dates
  const allDatesMap = expectedDateStrings.reduce((memo, dateString) => {
    memo[dateString] = null 
    return memo 
  }, {})

  const missing = filenames.reduce((memo, filename) => {

    const [ participantId, dateString, metric, extension ] = filename.split(/[_.]/)

    memo[dateString] = metrics.reduce((o, metric) => {
      o[metric] = true // true = missing
      return o
    }, {})

    // this metric is present, so we delete it
    //delete memo[dateString][metric]

    return memo

  }, allDatesMap)

  return missing

}

async function refreshAccessToken({ accessToken, refreshToken, participantId }) {

  try {
    const expirationWindow = 3600
    return await fbClient.refreshAccessToken(accessToken, refreshToken, expirationWindow)
  } catch(e) {
    logger.error(`Failed to refresh participant ${participantId}'s Refresh Access Token`)
    logger.error(e)
  }

}

module.exports = exports = {

  main,

  isValidDataset,
  isDataResponse,
  findUncapturedDates,
  generateQueryPathsByDate,
  queryFitbit,
  refreshAccessToken,

}
