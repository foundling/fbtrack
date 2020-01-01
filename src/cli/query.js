require('dotenv').config() 

const fs = require('fs')
const { 
  format, 
  addDays, 
  subDays, 
  differenceInDays, 
  isAfter, 
  isBefore  
} = require('date-fns')
const FitBitClient = require('fitbit-node')

const {
  CLIENT_ID,
  CLIENT_SECRET,
  DEFAULT_WINDOW_SIZE,
  FITBIT_ENDPOINTS,
  DB_NAME,
  DB_PATH,
  DATA_PATH,
  LOGS_PATH,
} = require('./../config')

const Database = require(DB_PATH)
const Logger = require('./logger')

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
const fbClient = new FitBitClient({ 
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

async function getFiles({ criterion, directory }) {

  try {

    const filenames = await readdirPromise(directory)
    return filenames.filter(criterion)

  } catch (e) {

    throw new Error('getFiles failed: ', e)

  }

}

const findUncapturedDates = (startDate, stopDate, allDatesCaptured) => {

    const startDateString = startDate.format(ymdFormat)
    const stopDateString = stopDate.format(ymdFormat)

    const idealDateRange = generateDateRange(startDateString, stopDateString)
    const capturedDatesInRange = allDatesCaptured.filter( inDateRange({start: startDateString, end: stopDateString}) )
    const uncapturedDatesInRange = idealDateRange.filter( dateNotIn(capturedDatesInRange) )

    return uncapturedDatesInRange

}

function extractFitBitData(days) {
    // need to take metrics for each day and flatten them into a single object

    return days.map(day => {

        // flatten subarray metrics for each day into a single object.
        return day
            .reduce((o, metric) => {
                 Object
                    .keys(metric[0])
                    .forEach(key => {
                        o[key] = metric[0][key]; 
                    })
                return o
            }, {})
    });  

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


async function main(participantId, { dates=[], windowSize=null, refresh=false }) {

  if (dates.length === 0 && windowSize == null)
    windowSize = DEFAULT_WINDOW_SIZE

  await db.init()

  const today = new Date()
  const participant = await getParticipantById(participantId)
  if (!participant) {
      await logger.error(`subject [ ${ participantId } ] is not in the database.`)
      return
  }
  const registrationDate = new Date(participant.registrationDate)

  if (differenceInDays(today, registrationDate) === 0) {
    await logger.success(`Subject ${ participant } was signed up today. No data to query.`);  
    return
  }

  if (refresh) {
    logger.info(`Access Token for participant ${ participantId } expired. Refreshing ...`)

    const refreshAccessToken = statefulRefreshAccessToken(participant)
    participant.accessToken = await refreshAccessToken()
  }

  const uncapturedDates = findUncapturedDatesInWindow({ participantId, today, windowSize, registrationDate })
  const datasets = getFitbitDataForDates({ dates: uncapturedDates, endpoints })

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

    return writeFilePromise(outputFilepath, serializedData)

    try {
      await fileWritePromises
    } catch(e) {
      logger.error(e)
    }
  }

}

async function getFitbitDataForDates({ dates, endpoints }) {

  const queryPaths = generateQueryPaths({ dates, metricEndpoints: endpoints })
  const requests = queryPaths.map(path => fbClient.get(path, participant.accessToken))

  try {
    const responses = await Promise.all(requests)
  } catch(e) {
    throw new Error(['Error retrieving fitbit data for dates', e])
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


async function getParticipantById(id) {

  // get participant by id
  try {
    const participant = await db.getParticipantByParticipantId(id)
    return participant
  } catch (e) {
    throw new Error(e)
  }

}

function datesFromRange({ start, stop }) {
  const dates = [start]
  let currentDate = start
  while (currentDate <= stop) {
    currentDate = addDays(currentDate, 1)
    dates.push(currentDate)
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

async function restartQuery({ subjectId }) {

    if (!subjectId) {
        await logger.error(subjectId)
        throw new Error(`Trying to restart query after token refresh, but have no subject id!`)
    }

    /* runs when acess token needs to be refreshed */
    db.fetchOneSubject(subjectId, (err, subjectData) => {
        if (err) throw err
        //preQueryCheck(subjectData)
    })

}

async function queryAPI(requestGroups) {

    await logger.info(`Requesting the following data from the FitBitAPI: [ ${ colors.white( config.scope.split(',').join(', ') ) } ].`); 

    Promise.all(requestGroups.map(requestGroup => Promise.all(requestGroup)))
        .then(handleAPIResponse, async (e) => { return await logger.info(e); })
        .catch(async (e) => { await logger.info('Something went wrong with the fitbit API query ... ', e); })

}

function handleAPIResponse(responseGroups) {

    const subjectId = db.sessionCache.get('subjectId')
    const signupDate = db.sessionCache.get('signupDate')

    const statusCodeStrings = responseGroups.map(toStatusCodeString)
    const errorResponses = responseGroups.filter(isErrorResponse)
    const dataResponses = responseGroups.filter(isDataResponse)
    const validDatasets = extractFitBitData(dataResponses).filter(isValidDataset); 

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

function statefulRefreshAccessToken({ accessToken, refreshToken, participantId }) {

  let maxRetries = 1

  return async function refreshAccessToken() {

    if (maxRetries > 0) {

      maxRetries -= 1

      try {

        const expirationWindow = 3600
        const newAccessToken = await fbClient.refreshAccessToken(accessToken, refreshToken, expirationWindow)
        await db.setParticipantAccessToken({ participantId, accessToken: newAccessToken })
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



function updateTokens({ accessToken, refreshToken }) {

    const newTokens = {
        accessToken,
        refreshToken
    }

    if ( ! (newTokens.accessToken && newTokens.refreshToken) ) {
        throw new Error(`Trying to replace token with null data! ${ newTokens }. Exiting ...`)
    }

    db.updateTokens(newTokens, (err) => {
        if (err) throw err
        restartQuery({ subjectId: db.sessionCache.get('subjectId') })
    })

}


module.exports = exports = {

    main,

    findUncapturedDates,

    extractFitBitData,
    handleAPIResponse,
    isErrorResponse,
    isDataResponse,
    isValidDataset,
    isClientError,
    queryAPI,
    toStatusCodeString,
    updateTokens,
    writeDatasetsToFiles
    
}

//main('001', { dates: ['2019-12-22', '2019-12-28'], refresh: false }).catch(console.log)
//main('001', { dates: ['2019-01-01', '2019-01-09'] }).catch(console.log)
//main('001', { dates: ['2019-01-01'] }).catch(console.log)
//main('001', {  }).catch(console.log)
