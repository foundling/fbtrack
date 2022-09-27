const path = require('path')
const fs = require('fs')
const { parseISO, differenceInDays } = require('date-fns')
const { cursorTo } = require('readline')

const config = require('../config').getConfig({ requiresUserSetup: true })
const { isValidParticipantFilename, parseParticipantFilename } = require('../lib/utils')
const { defaultLogger: logger } = require('../lib/logger')
const { listFormatter } = require('../lib/formatters')
const {
  datesWithinBoundaries,
  dateBoundariesFromWindowSize,
  calculateStartAndStopDates,
  ymdFormat,
  formatDateYYYYMMDD
} = require('../lib/dates')

const {
  readdirPromise,
  statPromise
} = require('../lib/io')

const Participant = require('./Participant')

const defaultQueryArgs = {
  participant: { ids: [], all: false },
  dates: { dateStart: null, dateStop: null, windowSize: null }
}

const makeList = listFormatter('•')

class Study {

  constructor({ name = '', dataPath, database } = {}) {

    if (!dataPath) {
      logger.error("Study constructor's 'dataPath' argument can't be null!")
      process.exit(1);
    
    }
    if (!fs.existsSync(dataPath)) {
      logger.error(`data path directory ${dataPath} does not exist!`)
      process.exit(1);
    }

    this.dataPath = path.isAbsolute(dataPath) ? dataPath : path.join(__dirname, dataPath)
    this.database = database
    this.name = name
    this.participants = new Map()
    this.initialized = false

  }

  async init() {

    this.participants = await this.buildParticipantMap()
    this.initialized = true

  }

  async buildParticipantMap() {

    const participants = new Map()
    const participantIdMap = await this.loadDataFromDisk({ dataPath: this.dataPath })
    const participantRecords = await this.database.getParticipants({ active: true })

    for (const record of participantRecords) {

      const { participantId } = record
      const participant = new Participant({
        files: participantIdMap.get(record.participantId) || [],
        participantId,
        record,
      })

      participants.set(participantId, participant);

    }

    return participants

  }

  async loadDataFromDisk({ dataPath }) {

    const entries = await readdirPromise(dataPath)
    const data = new Map()

    for (let entry of entries) {
      const entryStat = await statPromise(path.join(dataPath, entry))

      if (entryStat.isFile()) {
        if (!isValidParticipantFilename(entry)) {
          continue
        }
        const { participantId } = parseParticipantFilename(entry)
        if (!data.has(participantId)) {
          data.set(participantId, [])
        }
        data.get(participantId).push(entry)
      }
    }

    return data

  }

  async query({ participants={ ids, all }, dates, chunkSize=config.app.CHUNK_SIZE } = defaultQueryArgs) {

    // if ids are there, get list of ids matching current participants, reporting any not matched.
    // if all flag is there, use participant ids we have

    const { ids, all } = participants
    const invalidParticipants = all ? [] : ids.filter(id => !this.participants.has(id))

    if (invalidParticipants.length > 0) {

      const warning = `Skipping the following participants because they are not in the database: \n${makeList(invalidParticipants)}`
      logger.warn(warning)

    }

    // use existing participants or filter what we have by provided ids
    const targetParticipants = all ?
      this.participants :
      ids.reduce((memo, id) => {
        if (this.participants.get(id)) {
          memo.set(id, this.participants.get(id))
        }
        return memo
      }, new Map())

    const participantQueryFns = []

    targetParticipants.forEach(participant => {

      participantQueryFns.push(

        async () => {

          let errors = [];
          for await (const queryData of participant.query(dates.dateStart, dates.dateStop)) {

              const {
                  expectedQueryCount: total,
                  currentQueryCount: current,
                  error,
              } = queryData; 

              if (error) {
                  errors.push(error);
              }

              cursorTo(process.stdout, 0);
              process.stdout.write(`participant: ${participant.participantId} | ${ current }/${ total } metrics collected | errors: ${errors.length} `);

          }
          process.stdout.write('\n');

        }

      )

    })

    await this.runConcurrently(participantQueryFns, chunkSize)

  }

  async runConcurrently(funcs, chunkSize) {

    while (funcs.length > 0) {

      const chunk = funcs.splice(0, chunkSize)
      await Promise.all(chunk.map(f => f()))

    }
    console.log();

  }

}

module.exports = exports = exports = Study
