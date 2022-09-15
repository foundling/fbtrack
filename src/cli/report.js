const { format, parseISO, subDays } = require('date-fns')
const { groupBy } = require('lodash')

const config = require('../config').getConfig()

const {
  dates,
  formatters,
  http,
  io
} = require('../lib');

const { defaultLogger: logger } = require('../lib/logger')

const {
    dateRE,
    datesWithinBoundaries,
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

const { Database, Study } = require('../models');
const db = new Database({ databaseName: config.app.DB_NAME });
const metrics = Object.keys(config.fitbit.ENDPOINTS)

async function main({ all = false, participantIds:targetIds = [], missingOnly = false }) {

  const allParticipantFiles = await getFiles({ directory: config.app.RAW_DATA_PATH })
  const participants = await db.getParticipants({ active: true })

  const validParticipants = []
  const invalidParticipantIds = []
  const report = {}
  const output = []

  for (const targetId of targetIds) {

    const participant = participants.find(({ participantId }) => participantId == targetId)

    if (!participant) {
      invalidParticipantIds.push(targetId)
      continue
    }

    const { participantId, registrationDate } = participant
    const participantFiles = allParticipantFiles.filter(filename => filename.startsWith(participantId))
    const start = parseISO(registrationDate)
    const stop = subDays(new Date(), 1)

    const byDateByMetric = participantFiles.reduce((memo, filename) => {

      const [ id, dateString, metric, extension ] = filename.split(/[_.]/)
      if  (!memo[dateString]) {
        memo[dateString] = {}
      }

      memo[dateString][metric] = true

      return memo

    }, {})

    const dateStringsToCheck = datesWithinBoundaries({ start, stop }).map(d => format(d, ymdFormat))

    report[participantId] = dateStringsToCheck.reduce((memo, dateString) => {

      if (!memo[dateString]) {
        memo[dateString] = {}
      }

      for (const metric of metrics) {
        if (!byDateByMetric[dateString]) {
          memo[dateString][metric] = false
        } else {
          memo[dateString][metric] = Boolean(byDateByMetric[dateString][metric])
        }
      }

      return memo

    }, {})
  }

  if (invalidParticipantIds.length > 0) {
    logger.warn(`The following ids were requested, but do not exist in the database: ${ makeList(invalidParticipantIds) }`)
  }

  for (const participantId in report) {
    console.log(`participant: ${participantId}`)

    for (const dateString in report[participantId]) {
      console.log(`  ${dateString}`)

      for (const metric in report[participantId][dateString]) {
        const wasCaptured = report[participantId][dateString][metric]
        const symbol = wasCaptured ? '✓' : '✖'
        if (wasCaptured && missingOnly) {
          continue
        }
        console.log(`    ${symbol} ${metric}`)
      }
    }
  }

}

module.exports = { main }
