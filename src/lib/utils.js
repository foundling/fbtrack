const colors = require('colors')
const fs = require('fs')
const util = require('util')
const {
  addDays,
  differenceInDays,
  format,
  isAfter,
  isBefore,
  parseISO,
  subDays
} = require('date-fns')


const readdirPromise = util.promisify(fs.readdir)
const readFilePromise = util.promisify(fs.readFile)
const writeFilePromise = util.promisify(fs.writeFile)

const delayedRequire = function(path) { 
  return function(...args) {
    //return require(path).main.call(null, ...args) 
    return require(path).main(...args) 
  }
}

const isClientError = code => code >= 400 && code < 500
const isServerError = code => code >= 500 && code < 600
const isSuccess = code => 200 && code < 300

// 201_2020-01-10_activities-calories.json
// what if they use a '_' in the subjectId? like participant_2901

const filenamePattern = /^.*_[2][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]_.*_.json$/
const ymdFormat = 'yyyy-MM-dd' // this is fitbit's resource url format
const dateRE = /[2][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]/
const dateREStrict = /^[2][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/
const parseDateRange = (dateRangeString) => {

    const parts = dateRangeString.split(',').filter(part => !!part)
    let dates = null

    switch(parts.length) {

        case 0: 
            logToUserFail('You need a single argument or a comma-separated {start},{stop} argument to the -r flag')
            process.exit(1)
            break

        case 1:
            dates = { startDateString: parts[0], stopDateString: parts[0] }
            break

        case 2:
            dates = { startDateString: parts[0], stopDateString: parts[1] }
            break

        default: 
            dates = { startDateString: parts[0], stopDateString: parts[1] }
            break

    }

    return dates
}


async function getFiles({ criterion=()=>true, directory }) {

  try {

    const filenames = await readdirPromise(directory)
    return filenames.filter(criterion)

  } catch (e) {

    throw new Error(['getFiles failed: ', e])

  }

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


const generateQueryPaths = ({ dateStrings, metricEndpoints }) => {

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

function errorCallback(err) {
    if (err) throw err
}

function logToUserInfo(...msgs) {
    msgs.forEach(msg => {
        let colorized = colors.blue(msg)
        console.log(`[ ${ colors.white('info') } ] ${ colorized }`)
    })
}

function logToUserSuccess(...msgs) {

    msgs.forEach(msg => {
        let colorized = colors.blue(msg)
        console.log(`[ ${ colors.rainbow('success') } ] ${ colorized }`)
    })

}

function logToUserFail(...msgs) {

    msgs.forEach(msg => {
        let colorized = colors.blue(msg)
        console.log(`[ ${ colors.red('failed') } ] ${ colorized }`)
    })

}

function logToFile(filename, data) {
    fs.writeFile(
        filename,
        JSON.stringify(data, null, 4),
        errorCallback
    )
}

function appendToFile(filepath, msg) {
    fs.appendFile(filepath, msg, (err) => {
        if (err) throw err
    })
}

function debug(msg) {
    let colorized = colors.red(msg)
    console.log(`[ debug ]: ${ colorized }`)
}


function debugExit(msg) {
    if (msg) debug(msg)
    debug('[debug] exiting...')
    process.exit(1)
}


function inDateRange({ start, end }) {
    //return (date) => moment(date).isBetween( start, end, null, '[]')
}


const isRawDataFile = filename => dateRE.test(filename)
const dateNotIn = (list) => (dateString) => !list.includes(dateString)
const isValidDataSet = (day) => day['activities-heart-intraday'].length
const toStatusCodeString = (day) => day[1][1].statusCode.toString()

function toDateString(filename) {

    let match = dateRE.exec(filename)
    return match ? match[0] : match

}

/*
    review: no need for this function, just do 'dates.map(moment);'
*/
function toDate(dateString) {
    //return moment(dateString)
}

function matchesSubjectId(subjectId){
    return (filename) => filename.startsWith(subjectId)
}


const toHeartRateMetric = (metric) => metric.fitBitDate['activities-heart-intraday']
const toFitBitData = metric  => metric[0]
const compact = datum => !!datum
const toLength = arr => arr.length
const flattenOnce = arr => arr[0]

module.exports = exports = {
  appendToFile,
  datesFromRange,
  dateRangeFromDateStrings,
  dateRangeFromWindowSize,
  dateRE,
  dateREStrict,
  dateNotIn,
  debug,
  debugExit,
  delayedRequire,
  errorCallback,
  filenamePattern,
  getFiles,
  generateQueryPaths,
  inDateRange,
  isRawDataFile,
  isClientError,
  isServerError,
  isSuccess,
  logToFile,
  logToUserInfo,
  logToUserSuccess,
  logToUserFail,
  matchesSubjectId,
  parseDateRange,
  toDateString,
  toHeartRateMetric,
  toFitBitData,
  compact,
  toLength,
  flattenOnce,
  ymdFormat,
  readFilePromise,
  readdirPromise,
  writeFilePromise,
}
