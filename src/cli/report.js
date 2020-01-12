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

    dateRE, 
    datesFromRange,
    filenamePattern,
    getFiles,
    readFilePromise,
    readdirPromise,
    ymdFormat,

} = require('../lib/utils');

const listFormatter = sep => (items, fn=x=>x) => {
  return items.map(i => ` ${sep} ${fn(i)}`).join('\n')
}
const makeList = listFormatter('•') 

const Database = require(DB_PATH);
const db = new Database({ databaseFile: DB_NAME });
const metrics = Object.keys(FITBIT_CONFIG.ENDPOINTS)

async function main({ all=false, participantIds=[] }) {

  const allParticipantFiles = await getFiles({ directory: RAW_DATA_PATH })
  const participants = await db.getParticipants()
  const notFound = participantIds.filter(id => {
    return participants.findIndex(p => p.participantId === id) === -1
  })

  if (notFound.length > 0) {
    const list = makeList(notFound)
    logger.warn(`The following participants were requested but not found in the database:\n${list}\n`)
  }

  const targetParticipants = all ?
    participants.filter(p => p.isActive) : 
    participants.filter(p => participantIds.includes(p.participantId))

  logger.log('Participant Missing Data Report', {bold: true})

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
