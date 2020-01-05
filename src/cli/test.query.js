const tape = require('tape')
const { default: tapePromise } = require('tape-promise')
const { addDays, differenceInDays, format } = require('date-fns')

const test = tapePromise(tape)
const { FITBIT } = require('../config') 

const {

  datesFromRange,
  dateRangeFromWindowSize,
  dateRangeFromDateArgs,
  findUncapturedDatesInWindow,
  writeDatasetsToFiles,
  validateArgs

  //handleAPIResponse,
  //restartQuery,
  //formatFitbitErrors,
  //getFitbitDataForDates,
  //extractFitbitData,

} = require('./query')

test('[ cli:query ] getFitbitDataForDates', async (t) => {

  t.plan(2)

  const validRange = {
    start: new Date(2020,0,1),
    stop: new Date(2020,0,3)
  }
  const dates = datesFromRange(validRange)

  t.equal(dates.length, 3)

  t.throws(() => {
    const invalidRange = {
      start: new Date(2020,0,3),
      stop: new Date(2020,0,1)
    }
    const dates = datesFromRange(invalidRange)
  })

})
