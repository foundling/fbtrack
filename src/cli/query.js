const fs = require('fs')
const FitbitClient = require('fitbit-node')
const {
  addDays,
  differenceInDays,
  format,
  isAfter,
  isBefore,
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
  DATA_PATH,
  LOGS_PATH,
} = APP_CONFIG

const Database = require(DB_PATH)
const { defaultLogger: logger } = require('../lib/logger')

const {
  compact,
  dateRE,
  dateNotIn,
  debug,
  debugExit,
  errorCallback,
  generateQueryPaths,
  generateDateRange,
  inDateRange,
  matchesSubjectId,
  parseDateRange,
  readdirPromise,
  toDateString,
  toHeartRateMetric,
  ymdFormat,
  writeFilePromise,
} = require('../lib/utils')


const isValidDataset = (day) => !!day['activities-heart-intraday'].dataset.length
const toStatusCodeString = (day) => day[1][1].statusCode.toString()
const isErrorResponse = (day) => day.some(metric => metric[0].errors)
const isDataResponse = (day) => day.some(metric => metric[0]['activities-heart-intraday'])
const isClientError = (statusCode) => statusCode.startsWith('4')

const db = new Database({ databaseFile: DB_NAME })
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

  console.log({queryPathsByDate})
  console.log('EXITING')
  process.exit()

  const datasets = queryFitbit({
    dates, 
    participant, 
    queryPathsByDate,
    endpoints: ENDPOINTS
  })

  await logger.info(
    `Writing ${ datasets.length } datasets for ${participantId}.
     Output Path: ${ DATA_PATH }`
  )
  await writeDatasetsToFiles({ 
    datasets, 
    participantId, 
    path: DATA_PATH
  })

}

async function writeDatasetsToFiles({ participantId, datasets, path }) {

  for (const dataset of datasets) {

    const captureDate = dataset['activities-steps'][0]['dateTime']
    const outputFilepath = `${ path }/${ participantId }_${ captureDate }.json`
    const serializedData = JSON.stringify(dataset, null, 4)

    try {
      await writeFilePromise(outputFilepath, serializedData)
    } catch(e) {
      throw new Error([`Failed to write Fitbit participant file: ${ outputFilepath } for date ${ captureDate }. `, e])
      logger.error(e)
    }

  }

}

// review
function extractFitbitData(days) {

  return days.map(day => {

    return day.reduce((o, metric) => {
      Object
         .keys(metric[0])
         .forEach(key => {
             o[key] = metric[0][key]
         })
      return o
    }, {})

  })

}

async function getFiles({ criterion, directory }) {

  try {

    const filenames = await readdirPromise(directory)
    return filenames.filter(criterion)

  } catch (e) {

    throw new Error('getFiles failed: ', e)

  }

}

/*
 * Query Functions / Async Control Flow
 */

async function queryFitbit({ participant, dates, queryPathsByDate }) {

  // loop sequentially through each date
  // get metric request paths for that date
  // make a request for that
  // renew auth token if needed, when needed
  // wait until next window if we are rate limited

  console.log({ participant, dates, queryPathsByDate })
  console.log('EXITING')
  process.exit()

  const responses = []

  for (const date in queryPathsByDate) {

    const queriesForDate = queryPathsByDate[date]

    for (const queryPath in queriesForDate) {

      let response

      try {

        response = await fbClient.get(queryPath, participant.accessToken)

      } catch (e) {

        // 400 = access token expired
        if (e.code === 400) {

          // todo: verify returned data from client.refresh
          let { access_token, refresh_token } = await refreshAccessToken({
            participantId,
            accessToken: participant.accessToken,
            refreshToken: participant.refreshToken
          })

          await db.setParticipantAccessToken({
            participantId,
            accessToken: access_token,
            refreshToken: refresh_token
          })

          response = await fbClient.get(path, refreshedAccessToken)

        // 429 = rate limit exceeded
        } else if (e.code === 429) {

          // check retry after header for seconds until next run.
          // wait n seconds 
          // rate limit

        } else {
          logger.error(`Failed to get data for participant ${participant.participantId}`)
          logger.error(e)
        }
      }

      responses.push(response)

    }
  }

  return responses

}

async function findUncapturedDatesInWindow({ participantId, today, windowSize, registrationDate, dateRange }) {

  const filenames = await getFiles({
    directory: DATA_PATH, // parameterize
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

function datesFromRange({ start, stop }) {
  /* range is inclusive */

  if (differenceInDays(stop, start) < 0) {
    throw new Error('Invalid date range')
  }

  const dates = []
  let currentDate = start

  while (currentDate <= stop) {
    dates.push(currentDate)
    currentDate = addDays(currentDate, 1)
  }

  return dates

}

function dateRangeFromWindowSize({ windowSize, registrationDate, today }) {
  /* get date range starting at (yesterday - window size) until yesterday (inclusive), unless registration date
   * occurs in between that, in which case, registration date is start of range. */

  if (windowSize < 1) {
    throw new Error('windowSize must be greater than or equal to 1')
  }

  const yesterday = subDays(today, 1)
  const windowOffset = windowSize - 1
  /* note: date ranges are calculated in terms of offsets.
   * subtract 1 from windowSize to get offset */
  const startDate = new Date(
    Math.max(
      subDays(yesterday, windowOffset),
      registrationDate
    )
  )

  return [ startDate, yesterday ]

}

function dateRangeFromDateStrings({ dates }) {

  if (!dates || dates.length < 1 || dates.length > 2) {
    throw new Error('Dates array requires exactly two elements. Received ', JSON.stringify(dates))
  }

  const [ start, stop ] = dates

  if (dates.length === 1) {
    return [
      parseISO(start),
      parseISO(start)
    ]
  }

  if (dates.length == 2) {
    if (parseISO(start) > parseISO(stop)) {
      throw new Error('DateRangeFromDateStrings Error: start (first param) must come before stop')
    }
    return [
      parseISO(start),
      parseISO(stop)
    ]
  }

}

function handleAPIResponse(responseGroups) {

    const subjectId = db.sessionCache.get('subjectId')
    const signupDate = db.sessionCache.get('signupDate')

    const statusCodeStrings = responseGroups.map(toStatusCodeString)
    const errorResponses = responseGroups.filter(isErrorResponse)
    const dataResponses = responseGroups.filter(isDataResponse)
    const validDatasets = extractFitbitData(dataResponses).filter(isValidDataset)

  /*
    logger.info(`Status codes from request for subject ${ subjectId }: ${ colors.white(statusCodeStrings.join(',')) }.`)
    logger.info(`# valid datasets: ${ colors.white(validDatasets.length) }.`)
    logger.info(`# errors: ${ colors.white(errorResponses.length) }.`)
    */

    // this callback runs when all datasets are written. It runs regardless if there are datasets or not.
    writeDatasetsToFiles(subjectId, validDatasets, (err) => {
        if (err) throw err
        handleClientErrors(errorResponses.map(toStatusCodeString), refreshAccessToken)
    })

}

function handleClientErrors(clientErrorCodes, refreshCallback) {

    const tokenExpired = (errorCode) => errorCode === '401'
    const rateLimitExceeded = (errorCode) => errorCode === '429'
    const isNotRefreshError = (errorCode => errorCode.startsWith('4') && errorCode !== '401')

    const handleExpiredAuthToken = () => {

        logger.info(`Access Token for subject ${ db.sessionCache.get('subjectId') } has expired. Refreshing tokens ... `)

        db.fetchOneSubject(db.sessionCache.get('subjectId'), (err, subjectData) => {
            if (err) throw err
            refreshCallback(subjectData)
        })

    }

    const errorsToLog = clientErrorCodes.filter(isNotRefreshError)
    const needsRefresh = clientErrorCodes.some(tokenExpired)

    if (needsRefresh) handleExpiredAuthToken()
    //if (errorsToLog.length) logErrors(db.sessionCache.get('subjectId'), errorsToLog)

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

async function formatFitbitErrors ({ msg, errorObj }) {

  const { errors } = e.context
  const messages = errors.map(e => '\n * ' + e.message)
  await logger.error(`${msg}. Error details: ${ messages }`)

}

module.exports = exports = {

    main,

    getFiles,
    queryFitbit,
    datesFromRange,
    dateRangeFromWindowSize,
    dateRangeFromDateStrings,
    extractFitbitData,
    findUncapturedDatesInWindow,
    formatFitbitErrors,
    handleAPIResponse,
    writeDatasetsToFiles

}
