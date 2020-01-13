const fs = require('fs')
const path = require('path')
const FitbitClient = require('fitbit-node')
const {
  addDays,
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
const { dates, http, io } = require('../lib/utils')
const { promisify } = require('util')

const setTimeoutPromise = promisify(setTimeout)

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

  const today = new Date()

  const allParticipants = await db.getParticipants({ active: true }) // fix db to get active only, w/ flag 
  const targetParticipants = all ? allParticipants.filter(participant => participant.isActive) :
                                   allParticipants.filter(participant => participant.isActive && 
                                              participantIds.includes(participant.participantId))

  const targetParticipantIdMap = targetParticipants.reduce((memo, participant) => {
    memo[participant.participantId] = true
    return memo
  }, {})

  const invalidParticipantIds = participantIds.filter(id =>  {
    return !targetParticipantIdMap[id]
  })

  for (const participantId of invalidParticipantIds) {
    await logger.error(`subject [ ${ participantId } ] is not in the database. Have they been registered?`)
  }

  for (const participant of targetParticipants) {

    const { participantId, registrationDate } = participant

    if (differenceInDays(today, parseISO(registrationDate)) === 0) {
      await logger.info(`Subject ${ participantId } was signed up today. No data to query.`)
      return
    }

    const missingDates = await findUncapturedDatesInWindow({
      dateRange,
      participantId,
      registrationDate: new Date(registrationDate),
      today,
      windowSize,
    })

    if (missingDates.length === 0) {
      logger.info(`All dates captured for participant ${participantId} in this date range.`) 
      return
    }

    const queryPathsByDate = generateQueryPaths({
      dateStrings: missingDates,
      metricEndpoints: FITBIT_CONFIG.ENDPOINTS
    })

    // where to handle errors so you can continue w/ rest if one fails?
    const datasets = await queryFitbit({
      participant, 
      queryPathsByDate,
      endpoints: ENDPOINTS
    })

    await writeDatasetsToFiles({ 
      datasets,
      participantId, 
      outputDir: RAW_DATA_PATH,
      log: true,
    })

  }

}

function isValidDataset(day) {
  return !!day['activities-heart-intraday'].dataset.length
}

function isDataResponse(day) {
  return day.some(metric => metric[0]['activities-heart-intraday'])
}


function generateQueryPaths({ dateStrings, metricEndpoints }) {

  /* creates a nested map of date strings to metrics to endpoints for those metrics */

  const memo = {}

  // organize paths by dateString, then by metric
  for (const dateString of dateStrings) {
    for (const metricKey in metricEndpoints) {

      const resourcePath = metricEndpoints[metricKey].replace('%DATE%', dateString)

      if (!memo[dateString])
        memo[dateString] = {}

      memo[dateString][metricKey] = resourcePath

    }
  }

  return memo

}

// thought: use async generator here to push participantID in 
// in case of token expiration
async function queryFitbit({ participant, queryPathsByDate }) {

  const collectedData = {}

  for (const date in queryPathsByDate) {

    const queriesForDate = queryPathsByDate[date]

    for (const metric in queriesForDate) {
      const queryPath = queriesForDate[metric]

      try {

        const [ body, response ] = await fbClient.get(queryPath, participant.accessToken)
        const header = `\n${participant.participantId}\n${date}\n${metric}\n`

        if (isSuccess(response)) {

          if (!collectedData[date]) {
            collectedData[date] = {}
          }
          collectedData[date][metric] = body

        } else {

          logger.debug(response)

          if (accessTokenExpired(response)) {

            const { access_token:accessToken, refresh_token:refreshToken } = await refreshAccessToken({
              participantId: participant.participantId,
              accessToken: participant.accessToken,
              refreshToken: participant.refreshToken
            })

            // note: if this fails, all goes bad. important!
            await db.updateAccessTokensById({
              participantId: participant.participantId,
              accessToken,
              refreshToken
            })

            let [ retryBody, retryResponse ] = await fbClient.get(queryPath, access_token)
            const retryData = JSON.stringify(retryBody, null, 2)

            if (!collectedData[date]) {
              collectedData[date] = {}
            }

            collectedData[date][metric] = retryBody

          } else if (rateLimitExceeded(response)) {


            // not done here
            const secondsToWait = response.headers['retry-after']
            logger.error(`Rate limit exceeded. Waiting ${secondsToWait} seconds to resume ...`)

            await setTimeoutPromise(secondsToWait * 1000)


          } else if (invalidRefreshToken(response)) {
            // handle invalid refresh token
            // not done here
            // todo: write lib fn 
            console.log(
              `InvalidRefreshToken Error for participant ${participantId}. The subject needs to be re-authorized with the application. Please contact Alex.\n Error:\n`, JSON.stringify(response, null, 2)
            )
          }

        }

      } catch (e) {

        logger.error(e)

      }
    }

  }

  return collectedData

}

async function findUncapturedDatesInWindow({ participantId, today, windowSize, registrationDate, dateRange }) {

  const filenames = await getFiles({
    directory: RAW_DATA_PATH, // parameterize
    criterion: fname => fname.startsWith(participantId),
  })

  // todo: turn date metadata into a map, shouldn't have duplicates. makes missing calc faster
  const metadata = filenames.map(filename => {

    const [ participantId, dateString, extension ] = filename.split(/[_.]/)

    return {
      participantId,
      filename,
      dateString,
    }

  })

  const [ start, stop ] = windowSize ?
                    dateRangeFromWindowSize({ registrationDate, today, windowSize }) :
                    dateRangeFromDateStrings({ dates: dateRange })

  const expectedDates = datesFromRange({ start, stop }).map(d => format(d, ymdFormat))
  const capturedDates = metadata.map(md => md.dateString)
  const missingDates = expectedDates.filter(date => !capturedDates.includes(date))

  return missingDates

}

async function refreshAccessToken({ accessToken, refreshToken, participantId }) {

  try {
    const expirationWindow = 3600
    return await fbClient.refreshAccessToken(accessToken, refreshToken, expirationWindow)
  } catch(e) {
    logger.error(`Failed to participant ${participantId}'s Refresh Access Token`)
    logger.error(e)
  }

}

module.exports = exports = {

  main,

  isValidDataset,
  isDataResponse,
  findUncapturedDatesInWindow,
  generateQueryPaths,
  queryFitbit,
  refreshAccessToken,

}
