require('dotenv').config() 

const {
  DB_PATH,
  CLIENT_ID,
  CLIENT_SECRET,
  DATA_PATH,
  LOGS_PATH
} = process.env

const { format, addDays, subDays, differenceInDays, isAfter, isBefore  } = require('date-fns')

const fs = require('fs')
const util = require('util')
const moment = require('moment')
const FitBitClient = require('fitbit-node')

const readdirPromise = util.promisify(fs.readdir)
const writeFilePromise = util.promisify(fs.writeFile)
const Logger = require('./logger')
const logger = new Logger({
  logDir: LOGS_PATH,
  config: {
    info: false,
    warn: false,
    error: false,
    success: false
  }
})

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
    toDateString,
    toHeartRateMetric,
    ymdFormat, 

} = require('./utils')

const isValidDataset = (day) => !!day['activities-heart-intraday'].dataset.length
const toStatusCodeString = (day) => day[1][1].statusCode.toString()
const isErrorResponse = (day) => day.some(metric => metric[0].errors)
const isDataResponse = (day) => day.some(metric => metric[0]['activities-heart-intraday'])
const isClientError = (statusCode) => statusCode.startsWith('4')

const { logErrors } = require('./reporting/queryMonitor')

const fbClient = new FitBitClient({ 
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET
})

const Database = require(DB_PATH)
const db = new Database({ databaseFile: 'fbtest' })
const commandOptions = { windowSize: null }
const todaysDateString = moment().format(ymdFormat)

const DEFAULT_WINDOW_SIZE = 3

function preQueryCheck(subjectData) {

    if (!subjectData)
        return logToUserFail(`This subject id is not in the database.`)

    if (subjectData.signupDate === todaysDateString) {
        logToUserSuccess(`Subject ${subjectData.subjectId} was signed up today. No need to query.`);  
        process.exit(0)
    }

    getFiles(subjectData)

}

async function getFiles({ criterion, directory }) {

    try {

      const filenames = await readdirPromise(directory)
      return filenames.filter(criterion)

    } catch (e) {

      throw new Error(e)

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

function buildQueryPaths(dates) {

    const queryPaths = generateQueryPaths(dates)

    return queryPaths
    

    toPromiseArray(queryPaths)
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
  
    // todo: turn date metadata into a map, shouldn't have duplicates. makes missing calc faster

    const { error, warning } = validateArgs(participantId, { dates, windowSize, refresh })

    if (error)
      return logger.error(error)

    if (warning)
      logger.warn(warning)

    if (dates.length === 0 && windowSize == null)
      windowSize = DEFAULT_WINDOW_SIZE

    await db.init()

    let registrationDate
    let daysAgoRegistered
    let participant 
    let accessToken 

    const today = new Date()

    // get participant by id
    try {
      participant = await db.getParticipantByParticipantId(participantId)
      if (!participant) {
          await logger.error(`subject [ ${ participantId } ] is not in the database.`)
          return
      }

      registrationDate = new Date(participant.registration_date)
      daysAgoRegistered = differenceInDays(today, registrationDate) 

      if (daysAgoRegistered === 0) {
        await logger.success(`Subject ${ participant } was signed up today. No data to query.`);  
        return
      }

    } catch (e) {
      throw new Error(e)
    }

    // refresh token if needed -- add prop .refreshed to main? check against that?
    if (refresh) {
      await logger.info(`Running Fbtrack for subject ${participantId}`)
      try {
        accessToken = await refreshAccessToken(participant)
      } catch(e) {
        throw new Error(e)
      }
    }

    try {

      // filename, datestring, date
      const filenames = await getFiles({ 
        directory: DATA_PATH,
        criterion: fname => fname.startsWith(participantId),
      })

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
      const missingDateStrings = expectedDates.filter(date => !capturedDates.includes(date)).map(date => format(date, ymdFormat))
      const queryPaths = generateQueryPaths(missingDateStrings)
      const requests = toPromiseArray(queryPaths)
      
    } catch (e) {
      throw new Error(e)
    }

    // todo: flatten to 2d
    //const pathsByDate = dates.map(date => metrics.map(metric => makeRequest({ date, metric })))

}

function findMissingParticipantFiles({ dates, files }) {

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
        preQueryCheck(subjectData)
    })

}

function toPromiseArray(queryPaths) {
  return queryPaths.map(dates => { 
    return dates.map(metric => {
      return fbClient.get(metric, 'abc') //db.sessionCache.get('accessToken')); 
    }).flat()
  }).flat()
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
    if (errorsToLog.length) logErrors(db.sessionCache.get('subjectId'), errorsToLog)

}

function refreshAccessToken(subjectData) {

    if (refreshAccessToken.called) {
        logger.error(`Unexpected multiple token refresh attempts. Exiting ...`); 
        process.exit(1)
    } 
    refreshAccessToken.called = true

    fbClient
        .refreshAccessToken(subjectData.accessToken, subjectData.refreshToken, 3600)
        .then(updateTokens)
        .catch(e => {
            logger.error(`Token update failed. Error details: ${ JSON.stringify(e.context.errors[0]) }`)
        })
}

function updateTokens({ access_token, refresh_token }) {

    const newTokens = {
        accessToken: access_token,
        refreshToken: refresh_token
    }

    if ( ! (newTokens.accessToken && newTokens.refreshToken) ) {
        throw new Error(`Trying to replace token with null data! ${ newTokens }. Exiting ...`)
    }

    db.updateTokens(newTokens, (err) => {
        if (err) throw err
        restartQuery({ subjectId: db.sessionCache.get('subjectId') })
    })

}

function writeDatasetsToFiles(subjectId, datasets, nextCb) {

    if (!datasets.length) return nextCb(null)
    else logger.info(`writing ${ datasets.length } datasets, each to a separate file in ${ config.paths.rawData } ...`)

  /*
    [].forEach(datasets, (dataset, cb) => {
    //async.each(datasets, (dataset, cb) => {

        let serializedData = JSON.stringify(dataset, null, 4)
        let captureDate = dataset['activities-steps'][0]['dateTime']
        let outputFilename = `${ config.paths.rawData }/${ subjectId }_${ captureDate }.json`

        fs.writeFile(outputFilename, serializedData, (err) => { 
            cb(err); 
        })

    },
    nextCb())
    */
}

module.exports = exports = {

    main,

    buildQueryPaths,
    extractFitBitData,
    findUncapturedDates,
    handleAPIResponse,
    isErrorResponse,
    isDataResponse,
    isValidDataset,
    isClientError,
    queryAPI,
    refreshAccessToken,
    toPromiseArray,
    toStatusCodeString,
    updateTokens,
    writeDatasetsToFiles
    
}

main('001', { dates: ['2019-12-22', '2019-12-28'] }).catch(console.log)
//main('001', { dates: ['2019-01-01', '2019-01-09'] }).catch(console.log)
//main('001', { dates: ['2019-01-01'] }).catch(console.log)
//main('001', {  }).catch(console.log)
