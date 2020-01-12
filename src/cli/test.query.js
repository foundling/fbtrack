const tape = require('tape')
const { default: tapePromise } = require('tape-promise')

const { 
  addDays,
  differenceInDays,
  parseISO,
  format,
  subDays
} = require('date-fns')

const { FITBIT_CONFIG } = require('../config')
const { generateQueryPaths } = require('./query')

const {
  dates,
  io,
} = require('../lib/utils')

const {
  dateRE,
  ymdFormat, 
  datesFromRange,
  dateRangeFromWindowSize,
  dateRangeFromDateStrings,
  findUncapturedDatesInWindow,
} = dates

const { writeDatasetsToFiles } = io

const test = tapePromise(tape)

test('[ cli:query ] datesFromRange', (t) => {

  t.plan(2)

  const validRange = {
    start: new Date(2020,0,1),
    stop: new Date(2020,0,3)
  }
  const actualDates = datesFromRange(validRange).map(d => format(d, ymdFormat))
  const expectedDates =  [
    '2020-01-01',
    '2020-01-02',
    '2020-01-03'
  ]

  t.deepEqual(actualDates, expectedDates)

  t.throws(() => {
    const invalidRange = {
      start: new Date(2020,0,3),
      stop: new Date(2020,0,1)
    }
    const dates = datesFromRange(invalidRange)
  })

})

test('[ cli:query ] dateRangeFromWindowSize (registration date before window start)', (t) => {

  t.plan(1)

  const today = new Date(2020, 0, 7)
  const registrationDate = new Date(2020, 0, 1)
  const windowSize = 3
  const windowOffset = 2

  const actualDateRange = [ start, stop ] = dateRangeFromWindowSize({
    today,
    windowSize,
    registrationDate,
  })
  const expectedDateRange = [
    new Date(2020, 0, 4),
    new Date(2020, 0, 6)
  ]

  t.deepEqual(
    actualDateRange.map(d => format(d, ymdFormat)),
    expectedDateRange.map(d => format(d, ymdFormat))
  )

})

test('[ cli:query ] dateRangeFromWindowSize (registration date after window start)', (t) => {

  t.plan(1)

  const today = new Date(2020, 0, 7)
  const registrationDate = new Date(2020, 0, 6)
  const windowSize = 3
  const windowOffset = 2

  const actualDateRange = [ start, stop ] = dateRangeFromWindowSize({
    today,
    windowSize,
    registrationDate,
  })
  const expectedDateRange = [
    new Date(2020, 0, 6),
    new Date(2020, 0, 6)
  ]

  t.deepEqual(
    actualDateRange.map(d => format(d, ymdFormat)),
    expectedDateRange.map(d => format(d, ymdFormat))
  )

})

test('[ cli:query ] dateRangeFromWindowSize (registration date on window start)', (t) => {

  t.plan(1)

  const today = new Date(2020, 0, 7)
  const registrationDate = new Date(2020, 0, 5)
  const windowSize = 3
  const windowOffset = 2

  const actualDateRange = [ start, stop ] = dateRangeFromWindowSize({
    today,
    windowSize,
    registrationDate,
  })
  const expectedDateRange = [
    new Date(2020, 0, 5),
    new Date(2020, 0, 6)
  ]

  t.deepEqual(
    actualDateRange.map(d => format(d, ymdFormat)),
    expectedDateRange.map(d => format(d, ymdFormat))
  )

})

test('[ cli:query ] dateRangeFromWindowSize (invalid window)', (t) => {

  t.plan(1)

  const today = new Date(2020, 0, 7)
  const registrationDate = new Date(2020, 0, 5)
  const invalidWindowSize = 0
  const windowOffset = 0

  t.throws(() => {
    dateRangeFromWindowSize({
      today,
      windowSize: invalidWindowSize,
      registrationDate,
    })
  })

})


test('[ cli:query ] dateRangeFromDateStrings', (t) => {

  t.plan(1)

  const start = format(new Date(2020, 0, 1), ymdFormat)
  const stop = format(new Date(2020, 0, 4), ymdFormat)
  const expectedDateRange = [ start, stop ]

  const actualDateRange = dateRangeFromDateStrings({
    dates: [start, stop]
  }).map(date => format(date, ymdFormat))

  t.deepEqual(
    actualDateRange,
    expectedDateRange
  )

})

test('[ cli:query ] dateRangeFromDateStrings: fails when start is after stop', (t) => {

  t.plan(1)

  const start = format(new Date(2020, 0, 1), ymdFormat)
  const stop = format(new Date(2020, 0, 4), ymdFormat)

  t.throws((t) => {

    const actualDateRange = dateRangeFromDateStrings({
      dates: [stop, start]
    }).map(date => format(date, ymdFormat))

  })

})

test('[ cli:query ] dateRangeFromDateStrings', (t) => {

  // improve these tests
  t.plan(2)

  const dateStrings = [
    new Date(2020, 0, 4),
    new Date(2020, 0, 5),
    new Date(2020, 0, 6)
  ].map(date => format(date, ymdFormat))

  const numMetrics = Object.keys(FITBIT_CONFIG.ENDPOINTS).length 
  const pathMap = generateQueryPaths({
    dateStrings,
    metricEndpoints: FITBIT_CONFIG.ENDPOINTS
  })

  t.equal(
    Object.keys(pathMap).every(dateString => Object.keys(pathMap[dateString]).length === numMetrics),
    true
  )  

  t.equal(
    Object.keys(pathMap).length,
    dateStrings.length
  )

})
