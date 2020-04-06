const tape = require('tape')
const { default: tapePromise } = require('tape-promise')

const { 
  addDays,
  differenceInDays,
  parseISO,
  format,
  subDays
} = require('date-fns')

const { FITBIT_CONFIG } = require('../config').getConfig();
const { generateQueryPathsByDate } = require('./query')

const { dates, io } = require('../lib')

const {
  dateRE,
  ymdFormat, 
  datesWithinBoundaries,
  dateBoundariesFromWindowSize,
  dateBoundariesFromDates,
} = dates

const { writeDatasetsToFiles } = io

const test = tapePromise(tape)

test('[ cli:query ] datesWithinBoundaries', (t) => {

  t.plan(2)

  const validRange = {
    start: new Date(2020,0,1),
    stop: new Date(2020,0,3)
  }
  const actualDates = datesWithinBoundaries(validRange).map(d => format(d, ymdFormat))
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
    const dates = datesWithinBoundaries(invalidRange)
  })

})

test('cli :: query :: dateBoundariesFromWindowSize() - registration date before window start', (t) => {

  t.plan(1)

  const today = new Date(2020, 0, 7)
  const registrationDate = new Date(2020, 0, 1)
  const windowSize = 3
  const windowOffset = 2

  const actualDateRange = [ start, stop ] = dateBoundariesFromWindowSize({
    registrationDate,
    today,
    windowSize,
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

test('cli :: query :: dateBoundariesFromWindowSize() - registration date after window start', (t) => {

  t.plan(1)

  const today = new Date(2020, 0, 7)
  const registrationDate = new Date(2020, 0, 6)
  const windowSize = 3
  const windowOffset = 2

  const actualDateRange = [ start, stop ] = dateBoundariesFromWindowSize({
    registrationDate,
    today,
    windowSize,
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

test('cli :: query :: dateBoundariesFromWindowSize() - registration date on window start', (t) => {

  t.plan(1)

  const today = new Date(2020, 0, 7)
  const registrationDate = new Date(2020, 0, 5)
  const windowSize = 3
  const windowOffset = 2

  const actualDateRange = [ start, stop ] = dateBoundariesFromWindowSize({
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

test('cli :: query :: dateBoundariesFromWindowSize() - invalid window', (t) => {

  t.plan(1)

  const today = new Date(2020, 0, 7)
  const registrationDate = new Date(2020, 0, 5)
  const invalidWindowSize = 0
  const windowOffset = 0

  t.throws(() => {
    dateBoundariesFromWindowSize({
      registrationDate,
      today,
      windowSize: invalidWindowSize,
    })
  })

})


test('cli :: query :: dateBoundariesFromDates()', (t) => {

  t.plan(1)

  const start = new Date(2020, 0, 1)
  const stop = new Date(2020, 0, 4)
  const expectedDateRange = [ start, stop ]

  const actualDateRange = dateBoundariesFromDates({
    dates: [start, stop]
  })

  t.deepEqual(
    actualDateRange.map(date => format(date, ymdFormat)),
    expectedDateRange.map(date => format(date, ymdFormat)),
  )

})

test('cli :: query :: dateBoundariesFromDates() - fails when stop is before start', (t) => {

  t.plan(1)


  t.throws((t) => {

    const start = new Date(2020, 0, 4) 
    const stop = new Date(2020, 0, 1) 
    const actualDateRange = dateBoundariesFromDates({
      dates: [ start, stop ]
    })

  })

})
