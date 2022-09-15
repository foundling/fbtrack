const config = require('../config').getConfig({ requiresUserSetup: true })
const {
  addDays,
  differenceInDays,
  format,
  isAfter,
  isBefore,
  max,
  parseISO,
  subDays
} = require('date-fns')


// e.g. 201_2020-01-10_activities-calories.json
// TODO: validate subject ids to disallow '_'
const filenamePattern = /^.+_[2][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]_[^.]*\.json$/
const ymdFormat = 'yyyy-MM-dd' // this is fitbit's resource url format
const dateRE = /[2][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]/
const dateREStrict = /^[2][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/


function formatDateYYYYMMDD(date) {

  const year = date.getUTCFullYear()
  const month  = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const formattedDate = `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;

  return formattedDate;
}

function calculateStartAndStopDates(dateRange=[], windowSize=null) {

    // TODO: turn this into a fn
  let dateStart, dateStop;

  if (dateRange.length === 0) {

    if (windowSize == null) {
        windowSize = Number(config.user.WINDOW_SIZE)
    }

    dateStop = new Date();
    dateStart = subDays(new Date(dateStop), windowSize);

  } else if (dateRange.length === 1) {

    dateStop = new Date(dateRange[0]);
    dateStart = subDays(dateStop, 3)

  } else if (dateRange.length === 2) {

    dateStop = new Date(dateRange[1]);
    dateStart = new Date(dateRange[0]);

  }

  return [ dateStart, dateStop ]

}

function datesWithinBoundaries(start, stop) {

  /*
   * TODO: better fn docs needed generally!
   *
   * - range is inclusive
   * - returns dates
   *
   */

  if (differenceInDays(stop, start) < 0) {
    throw new Error(`Invalid date range: ${format(start, ymdFormat)}..${format(stop, ymdFormat)}`)
  }

  const dates = []
  let currentDate = start

    // FIXME:off by one
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
  const start = max([
    subDays(stop, windowOffset),
    registrationDate
  ])

  return [ start, stop ]

}

module.exports = exports = {
  datesWithinBoundaries,
  dateBoundariesFromWindowSize,
  calculateStartAndStopDates,
  dateRE,
  dateREStrict,
  filenamePattern,
  formatDateYYYYMMDD,
  ymdFormat,
}
