require('dotenv').config() 

const fs = require('fs')

const FitbitClient = require('fitbit-node')
const { 
  format, 
  addDays, 
  subDays, 
  differenceInDays, 
  isAfter, 
  isBefore  
} = require('date-fns')

const { PATHS, FITBIT } = require('../config')

const {
  CLIENT_ID,
  CLIENT_SECRET,
  DEFAULT_WINDOW_SIZE,
  ENDPOINT_TEMPLATES,
} = FITBIT

const {
  DB_NAME,
  DB_PATH,
  DATA_PATH,
  LOGS_PATH,
} = PATHS

const Database = require(DB_PATH)
const Logger = require('../lib/logger')

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
const logger = new Logger({
  logDir: LOGS_PATH,
  config: {
    info: false,
    warn: false,
    error: false,
    success: false
  }
})

async function main(participantId, { dates=[], windowSize=null, refresh=false }) {

  if (dates.length === 0 && windowSize == null) {
    windowSize = DEFAULT_WINDOW_SIZE
  }

  await db.init()

  const today = new Date()
  const participant = { participantId, accessToken, refreshToken } = await db.getParticipantById(participantId)

  if (!participant) {
      await logger.error(`subject [ ${ participantId } ] is not in the database.`)
      return
  }
  const registrationDate = new Date(participant.registrationDate)
  const refreshAccessTokenFn = statefulRefreshAccessToken({
    participantId,
    accessToken,
    refreshToken,
    maxRetries: 1
  })

  if (differenceInDays(today, registrationDate) === 0) {
    await logger.success(`Subject ${ participant } was signed up today. No data to query.`);  
    return
  }

  if (refresh) {
    logger.info(`Access Token for participant ${ participantId } expired. Refreshing ...`)

    participant.accessToken = await refreshAccessTokenFn()
  }

  const uncapturedDates = findUncapturedDatesInWindow({ 
    participantId,
    today,
    windowSize,
    registrationDate
  })

  // return errors here. 
  // process successful resposnes
  // handle errors separately

  const datasets = getFitbitDataForDates({
    dates: uncapturedDates,
    endpoints: ENDPOINT_TEMPLATES
  })

  await logger.info(
    `Writing ${ datasets.length } datasets for ${participantId}. 
     Output Path: ${ DATA_PATH }`
  )

  writeDatasetsToFiles({ participantId, datasets, path: DATA_PATH })

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

function extractFitbitData(days) {

  return days.map(day => {

    return day.reduce((o, metric) => {
      Object
         .keys(metric[0])
         .forEach(key => {
             o[key] = metric[0][key]; 
         })
      return o
    }, {})

  });  

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

function validateArgs(participantId, { dates=[], windowSize = null, refresh=false }) {

   // both window size and range, invalid
  if (dates.length > 0 && windowSize !== null) {
    return { error: 'Provide a window size or a date range, but not both.' }
  }

  // check dates for validity
  if (!dates.every(date => dateRE.test(date))) {
    return { error: `invalid date format: ${dates.join('..')}` }
  }

  // if both values are missing, set default window size
  if (!dates.length && windowSize == null) {
    return { warning: 'no date range provided, no window size provided. using default window size of 3 days' }
  }

  return {}

}


async function getFitbitDataForDates({ dates, endpoints }) {

  const queryPaths = generateQueryPaths({ dates, metricEndpoints: endpoints })
  const requests = queryPaths.map(path => fbClient.get(path, participant.accessToken))

  try {
    const responses = await Promise.all(requests)
  } catch(e) {
    throw new Error(['Error retrieving Fitbit data for dates', e])
  }

  return responses
  
}

async function findUncapturedDatesInWindow({ participantId, today, windowSize, registrationDate }) {

  const filenames = await getFiles({ 
    directory: DATA_PATH,
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
                    dateRangeFromDateArgs({ dates }) 

  const expectedDates = datesFromRange({ start, stop })
  const capturedDates = metadata.map(md => md.date)
  const missingDates = expectedDates.filter(date => !capturedDates.includes(date)).map(date => format(date, ymdFormat))

  return missingDates

}

function datesFromRange({ start, stop }) {

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

  const startDate = new Date(
    Math.max(
      subDays(today, windowSize),
      registrationDate
    )
  )

  const dateRange = [ startDate, addDays(startDate, windowSize) ]
  return dateRange

}

function dateRangeFromDateArgs({ dates }) {

  let dateRange

  if (dates.length === 1) return [ new Date(dates[0]), new Date(dates[0]) ]
  if (dates.length >= 2)  return [ new Date(dates[0]),  new Date(dates[1]) ]


}

async function restartQuery({ participantId }) {

    // still needed? see refreshAccessTokenFn
    if (!participantId) {
        await logger.error(participantId)
        throw new Error(`Trying to restart query after token refresh, but have no subject id!`)
    }

    const participant = await db.getParticipantById(participantId)

}

function handleAPIResponse(responseGroups) {

    const subjectId = db.sessionCache.get('subjectId')
    const signupDate = db.sessionCache.get('signupDate')

    const statusCodeStrings = responseGroups.map(toStatusCodeString)
    const errorResponses = responseGroups.filter(isErrorResponse)
    const dataResponses = responseGroups.filter(isDataResponse)
    const validDatasets = extractFitbitData(dataResponses).filter(isValidDataset); 

  /*
    logger.info(`Status codes from request for subject ${ subjectId }: ${ colors.white(statusCodeStrings.join(',')) }.`)
    logger.info(`# valid datasets: ${ colors.white(validDatasets.length) }.`)
    logger.info(`# errors: ${ colors.white(errorResponses.length) }.`)
    */

    // this callback runs when all datasets are written. It runs regardless if there are datasets or not.
    writeDatasetsToFiles(subjectId, validDatasets, (err) => { 
        if (err) throw err; 
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

function statefulRefreshAccessToken({ maxRetries = 1, accessToken, refreshToken, participantId }) {

  /* returns a function that will refresh an accessToken maxRetries times */

  return async function refreshAccessToken() {

    if (maxRetries > 0) {

      maxRetries -= 1

      try {

        const expirationWindow = 3600
        const { access_token, refresh_token } = await fbClient.refreshAccessToken(accessToken, refreshToken, expirationWindow)

        // todo: verify returned data from client.refresh
        await db.setParticipantAccessToken({
          participantId,
          accessToken: access_token, 
          refreshToken: refresh_token
        })

        return newAccessToken

      } catch(e) {
        formatFitbitErrors({ msg: 'Failed to refresh Access token', errorObj: e })
      }

    } else {

      logger.error(`Unexpected multiple token refresh attempts. Exiting ...`); 
      process.exit(1)

    }

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
    getFitbitDataForDates,
    datesFromRange,
    dateRangeFromWindowSize,
    dateRangeFromDateArgs,
    extractFitbitData,
    findUncapturedDatesInWindow,
    formatFitbitErrors,
    handleAPIResponse,
    restartQuery,
    writeDatasetsToFiles,
    validateArgs
    
}
