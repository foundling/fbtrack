const colors = require('colors')
const fs = require('fs')
const util = require('util')
const format = require('date-fns/format')

const delayedRequire = function(path) { 
  return function(...args) {
    //return require(path).main.call(null, ...args) 
    return require(path).main(...args) 
  }
}

const ymdFormat = 'yyyy-MM-dd'
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

const generateDateRange = (startDateString, stopDateString) => {

    if (! (startDateString && stopDateString) ) {
        throw new Error('startDateString and stopDateString are required')
    }

    //const start = moment(startDateString)
    //const stop = moment(stopDateString)
    const diffDays = stop.diff(start, 'days'); 

    const dates = []; 
     
    for(let dayOffset = 0; dayOffset <= diffDays; ++dayOffset) {
        let nextDate = start
            .clone()
            .add({ days: dayOffset })
            .format('YYYY-MM-DD')
        dates.push(nextDate)
    } 
     
    return dates

}

// [dates], [metricEndpoints] => [ requestPaths ]
const generateQueryPaths = ({ dates, metricEndpoints }) => {

    // metric name -> path w/ date replaced
    const metrics = Object.keys(metricEndpoints)

    return dates.map(date => {
      return metrics.map(metric => {
        return metricEndpoints[metric].replace('%DATE%', format(date, ymdFormat))
      })
    }).flat()

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
const isClientError = (statusCode) => statusCode.startsWith('4')
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

function dateComparator (isDescending) {

    return function(a,b) {

      /*
        return isDescending ? 
        moment(b).unix() - moment(a).unix() : 
        moment(a).unix() - moment(b).unix()
        */

    }
}

const toHeartRateMetric = (metric) => metric.fitBitDate['activities-heart-intraday']
const toFitBitData = metric  => metric[0]
const compact = datum => !!datum
const toLength = arr => arr.length
const flattenOnce = arr => arr[0]

module.exports = exports = {
    appendToFile,
    dateRE,
    dateREStrict,
    dateComparator,
    dateNotIn,
    debug,
    debugExit,
    delayedRequire,
    errorCallback,
    generateQueryPaths,
    generateDateRange,
    inDateRange,
    isRawDataFile,
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
    readdirPromise: util.promisify(fs.readdir),
    writeFilePromise: util.promisify(fs.writeFile),
}
