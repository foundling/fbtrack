const {
  addDays,
  differenceInDays,
  format,
  isAfter,
  isBefore,
  parseISO,
  subDays
} = require('date-fns')


// e.g. 201_2020-01-10_activities-calories.json
const filenamePattern = /^.+_[2][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]_[^.]*\.json$/
const ymdFormat = 'yyyy-MM-dd' // this is fitbit's resource url format
const dateRE = /[2][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]/
const dateREStrict = /^[2][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/

function datesWithinBoundaries(start, stop) {

  /*
   * - range is inclusive
   * - returns dates
   */

  if (differenceInDays(stop, start) < 0) {
    throw new Error(`Invalid date range: ${format(start, ymdFormat)}..${format(stop, ymdFormat)}`)
  }

  const dates = []
  let currentDate = start

  while (currentDate <= stop) {
    dates.push(currentDate)
    currentDate = addDays(currentDate, 1)
  }

  return dates

}

function dateBoundariesFromWindowSize({ windowSize, registrationDate, today=new Date() }) {
  /* get date range starting at (yesterday - window size) until yesterday (inclusive), unless registration date
   * occurs in between that, in which case, registration date is start of range. */

  if (windowSize < 1) {
    throw new Error('windowSize must be greater than or equal to 1')
  }

  const stop = subDays(today, 1)
  const windowOffset = windowSize - 1
  /* note: date ranges are calculated in terms of offsets.
   * windowSize is number of days, so subtract 1 to get offset */
  const start = new Date(
    Math.max(
      subDays(stop, windowOffset),
      registrationDate
    )
  )

  return [ start, stop ]

}

function dateBoundariesFromDates({ dates, registrationDate }) {

  if (!dates || dates.length < 1 || dates.length > 2) {
    throw new Error('Dates array requires exactly two elements. Received ', JSON.stringify(dates))
  }

  if (dates.length === 2 && dates[0] > dates[1]) {
    throw new Error('Stop Date before Start Date')
  }

  const [ potentialStart, stop ] = dates
  const startUnixEpoch = new Date(Math.max(potentialStart, registrationDate))
  const start = parseISO(startUnixEpoch.toISOString())
  console.log({ potentialStart, registrationDate })
  console.log({ start, stop })

  return start && stop ? [ start, stop ] : [ start || stop, start || stop ]

}

module.exports = exports = {
  datesWithinBoundaries,
  dateBoundariesFromWindowSize,
  dateBoundariesFromDates,
  dateRE,
  dateREStrict,
  filenamePattern,
  ymdFormat,
}
