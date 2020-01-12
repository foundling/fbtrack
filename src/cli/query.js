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

const {
  datesFromRange,
  dateRangeFromWindowSize,
  dateRangeFromDateStrings,
  dateRE,
  ymdFormat,
} = dates

const {
  isClientError,
  isServerError,
  isSuccess,
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

async function main(participantId, { dateRange=[], windowSize=null, refresh=false }) {

  if (dateRange.length === 0 && windowSize == null) {
    windowSize = WINDOW_SIZE
  }

  await db.init()

  const today = new Date()
  const participant = await db.getParticipantById(participantId)

  if (!participant) {
    await logger.error(`subject [ ${ participantId } ] is not in the database. Have they been registered?`)
    return
  }

  const registrationDate = new Date(participant.registrationDate)

  if (differenceInDays(today, registrationDate) === 0) {
    await logger.success(`Subject ${ participant } was signed up today. No data to query.`)
    return
  }

  const dateStrings = await findUncapturedDatesInWindow({
    dateRange,
    participantId,
    registrationDate,
    today,
    windowSize,
  })


  const queryPathsByDate = generateQueryPaths({
    dateStrings,
    metricEndpoints: FITBIT_CONFIG.ENDPOINTS
  })

  const datasets = await queryFitbit({
    participant, 
    queryPathsByDate,
    endpoints: ENDPOINTS
  })

  await logger.info(
    `Writing ${ datasets.length } datasets for ${participantId}.
     Output Path: ${ RAW_DATA_PATH }`
  )
  await writeDatasetsToFiles({ 
    datasets,
    participantId, 
    outputDir: RAW_DATA_PATH
  })

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

  // loop sequentially through each date
  // get metric request paths for that date
  // make a request for that
  // renew auth token if needed, when needed
  // wait until next window if we are rate limited

  const responses = {}

  for (const date in queryPathsByDate) {

    const queriesForDate = queryPathsByDate[date]
    for (const metric in queriesForDate) {

      const queryPath = queriesForDate[metric]

      let response

      try {

        const [ body, response ] = await fbClient.get(queryPath, participant.accessToken)
        const header = `\n${participant.participantId}\n${date}\n${metric}\n`


        if (isSuccess(response.statusCode)) {

          if (!responses[date]) {
            responses[date] = {}
          }
          responses[date][metric] = body

        } else {

          if (accessTokenExpired(response.statusCode)) {

            let { access_token, refresh_token } = await refreshAccessToken({
              participantId: participant.participantId,
              accessToken: participant.accessToken,
              refreshToken: participant.refreshToken
            })

            await db.updateAccessTokensById({
              participantId: participant.participantId,
              accessToken: access_token,
              refreshToken: refresh_token
            })

            let [ retryBody, retryResponse ] = await fbClient.get(queryPath, access_token)
            const retryData = JSON.stringify(retryBody, null, 2)

            if (!responses[date]) {
              responses[date] = {}
            }

            responses[date][metric] = retryBody

          } else if(rateLimitExceeded(response.statusCode)) {
            const secondsToWait = response.headers.retryAfter
            console.log(`rate limit exceeded. try again in ${secondsToWait} seconds...`)
          }

        }

      } catch (e) {

        logger.error(e)

      }
    }

  }

  return responses

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
      filename,
      dateString,
      date: new Date(dateString)
    }

  })

  const [ start, stop ] = windowSize ?
                    dateRangeFromWindowSize({ registrationDate, today, windowSize }) :
                    dateRangeFromDateStrings({ dates: dateRange })

  const expectedDates = datesFromRange({ start, stop })
  const capturedDates = metadata.map(md => md.date)
  const missingDates = expectedDates.filter(date => !capturedDates.includes(date)).map(date => format(date, ymdFormat))

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
