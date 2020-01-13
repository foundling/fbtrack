const { format, parseISO, subDays } = require('date-fns')
const { groupBy } = require('lodash')
const { defaultLogger:logger } = require('../lib/logger')

const { FITBIT_CONFIG, APP_CONFIG } = require('../config')
const { 
  DB_NAME,
  DB_PATH,
  DB_FILENAME,
  RAW_DATA_PATH 
} = APP_CONFIG

const {
  dates,
  formatters,
  http,
  io
} = require('../lib/utils');

const {
    dateRE, 
    datesFromRange,
    filenamePattern,
    ymdFormat,
} = dates

const {
    getFiles,
    readFilePromise,
    readdirPromise,
} = io

const {
  listFormatter
} = formatters

const makeList = listFormatter('•') 

const Database = require(DB_PATH);
const db = new Database({ databaseFile: DB_NAME });
const metrics = Object.keys(FITBIT_CONFIG.ENDPOINTS)

async function main({ all=false, participantIds=[] }) {

  const allParticipantFiles = await getFiles({ directory: RAW_DATA_PATH })
  const participants = await db.getParticipants()
  const notFound = participantIds.filter(id => Boolean(id.trim()))
    .filter(id => participants.findIndex(p => p.participantId === id) === -1)

  logger.log('\nParticipant Missing Data Report\n', {bold: true})
  if (notFound.length > 0) {
    const list = makeList(notFound)
    logger.warn(`The following participants were requested but not found in the database:\n${list}\n`)
  }

  const targetParticipants = participantIds.length > 0 ?
    participants.filter(p => participantIds.includes(p.participantId)) :
    participants.filter(p => p.isActive)

  for (const participant of targetParticipants) {

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

    const header = `[ participant id: ${participantId} | registered on ${registrationDate} ]` 
    console.log(`${header}\n${makeList(missingDates)}`)

  }

}

module.exports = { main }
