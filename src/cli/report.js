const { format, parseISO, subDays } = require('date-fns')
const { groupBy } = require('lodash')
const logger = require('../lib/logger')
const { FITBIT_CONFIG, APP_CONFIG } = require('../config')
const { 
  DB_NAME,
  DB_PATH,
  DB_FILENAME,
  RAW_DATA_PATH 
} = APP_CONFIG

const { 

    dateRE, 
    dateNotIn,
    dateComparator,
    datesFromRange,
    filenamePattern,
    getFiles,
    generateDateRange, 
    logToUserSuccess, 
    logToUserInfo, 
    toDateString,
    isRawDataFile,
    includesDate,
    readFilePromise,
    readdirPromise,
    ymdFormat,

} = require('../lib/utils');

const Database = require(DB_PATH);
const db = new Database({ databaseFile: DB_NAME });

const metrics = Object.keys(FITBIT_CONFIG.ENDPOINTS)

async function main({ participantId }) {

  const allParticipantFiles = await getFiles({ directory: RAW_DATA_PATH })
  const participants = participantId ? [ await db.getParticipantById(participantId) ] : await db.getParticipants()

  console.log('[ Missing Data ]')

  for (const participant of participants) {

    const { participantId, registrationDate } = participant
    const participantFiles = allParticipantFiles.filter(filename => filename.startsWith(participantId))
    const expectedDates = datesFromRange({
      start: parseISO(registrationDate),
      stop: subDays(new Date(), 1)
    }).map(d => format(d, ymdFormat))

    const actualDates = participantFiles.map(filename => {
      const [ id, date, metric, extension ] = filename.split(/[_.]/)
      return date
    })

    const missingDates = expectedDates.filter(expectedDateString => {
      return !actualDates.includes(expectedDateString)
    })

    console.log(`${participantId} is missing data for the following dates: ${missingDates.join('\n  ')}`)

  }

}



module.exports = { main }
