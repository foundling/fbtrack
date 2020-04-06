const path = require('path')
const fs = require('fs')
const { format, parseISO, differenceInDays } = require('date-fns')

const { isValidParticipantFilename, parseParticipantFilename } = require('../lib/utils')
const { defaultLogger: logger } = require('../lib/logger')
const { listFormatter } = require('../lib/formatters')
const {
  datesWithinBoundaries,
  dateBoundariesFromWindowSize,
  dateBoundariesFromDates,
  ymdFormat,
} = require('../lib/dates')

const { readdirPromise, statPromise } = require('../lib/io')
const Participant = require('./Participant')

const {
  APP_CONFIG,
  FITBIT_CONFIG
} = require('../config').getConfig({ requiresUserSetup: true })

const defaultQueryArgs = {
  participant: { ids: [], all: false },
  dates: { range: [], window: null },
  chunkSize: APP_CONFIG.CHUNK_SIZE,
}

class ProgressBar {

  constructor() {
    this.participants = new Map()
  }

  addParticipant({ participantId, dates, metrics }) {

    this.participants.set(participantId, new Map())

    for (const date of dates) {

      this.participants
        .get(participantId)
        .set(date, new Map()) 

      for (const metric of metrics) {

        this.participants
          .get(participantId)
          .get(date)
          .set(metric, false)

      }
    }

  }

  updateParticipantStats({ participantId, date, metric, collected, error }) {

    // TODO: handle errors
    this.participants.get(participantId)
      .get(date)
      .set(metric, collected) 

  }

  export() {

    let lines = ''
    for (const [ id, participantDates ] of this.participants) {

      let metricsCollected = 0
      const metricsExpected = participantDates.size * FITBIT_CONFIG.ENDPOINTS.size

      for (const [date, metrics] of participantDates) {
        for (const [metric, collected] of metrics) { 
          metricsCollected += Number(collected)
        }
      }

      const nextLine = [
        `participant id: ${id}`,
        `collected: ${metricsCollected}/${metricsExpected}`,
      ].join(' | ')

      lines += `${nextLine}\n`

    }

    return lines
  }

  rerender() {

    process.stdout.clearLine();  // clear current text
    process.stdout.cursorTo(0);  // move cursor to beginning of line
    console.clear();

    const lines = this.export()
    process.stdout.write(`${lines}\n`)

  }

}

class Study {

  constructor({ name = '', dataPath = null, flat = false, database = null, chunkSize } = {}) {

    if (dataPath === null || !fs.existsSync(dataPath)) {
      throw new Error(`Study constructor's 'dataPath' argument can't be null!`)
    }

    this.dataPath = path.isAbsolute(dataPath) ? dataPath : path.join(__dirname, dataPath)
    this.database = database
    this.flat = flat
    this.name = name
    this.participants = new Map()
    this.initialized = false

  }

  async init() {

    this.participants = await this.buildParticipants()
    this.initialized = true

  }

  async buildParticipants() {

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

    return await (this.flat ? this.loadFlat({ dataPath }) : this.loadHierarchical({ dataPath }))

  }

  async loadFlat() {

    const dataPath = this.dataPath
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

  async loadHierarchical() {

    const dataPath = this.dataPath
    const data = new Map()
    const entries = await readdirPromise(dataPath)

    for (let entry of entries) {
      const entryStat = await statPromise(path.join(dataPath, entry))
      if (entryStat.isDirectory()) {
        data.set(entry, [])
        const filenames = await readdirPromise(path.join(dataPath, entry))
        for (let filename of filenames) {
          const filenameStat = await statPromise(path.join(dataPath,entry,filename))
          if (filenameStat.isFile()) {
            data.get(entry).push(filename)
          }
        }
      }
    }

    return data

  }

  calculateDateBoundaries({ range, window, registrationDate }) {

    return range.length ?
      dateBoundariesFromDates({ dates: range }) : // 1 or 2 date args -> [start, stop]
      dateBoundariesFromWindowSize({
        windowSize: window,
        registrationDate: parseISO(registrationDate),
      })

  }

  async query({ participant={ ids, all }, dates={ range, window }, chunkSize } = defaultQueryArgs) {

    // if ids are there, get list of ids matching current participants, reporting any not matched.
    // if all flag is there, use participant ids we have

    const { ids, all } = participant
    const missing = all ? [] : ids.filter(id => !this.participants.has(id))

    if (missing.length > 0) {

      const makeList = listFormatter('•')
      const warning = `the following participants were queried
                        but are not in the database: \n${makeList(missing)}`
      logger.warn(warning)

    }

    // use existing participants or filter what we have by provided ids
    const targetParticipants = all ?
      this.participants :
      ids.reduce((memo, id) => {
        // alternative to a map and filter
        if (this.participants.get(id)) {
          memo.set(id, this.participants.get(id))
        }
        return memo
      }, new Map())

    const participantQueryFns = []
    const collectionStats = new ProgressBar()
    targetParticipants.forEach(participant => {

      const [ dateStart, dateStop ] = this.calculateDateBoundaries({
        range: dates.range,
        window: dates.window,
        registrationDate: participant.record.registrationDate
      })

      collectionStats.addParticipant({
        participantId: participant.participantId,
        dates: datesWithinBoundaries({ dates: [ dateStart, dateStop ] }),
        metrics: [...FITBIT_CONFIG.ENDPOINTS.keys()],
      })

      participantQueryFns.push(
        async () => {
          for await (const stats of participant.query(dateStart, dateStop)) {
            collectionStats.updateParticipantStats(stats)
            collectionStats.rerender()
          }
        }
      )

    })

    collectionStats.rerender()
    await this.runConcurrently(participantQueryFns, chunkSize)

  }

  async runConcurrently(funcs, chunkSize=1) {

    while (funcs.length > 0) {

      const chunk = funcs.splice(0, chunkSize)
      await Promise.all(chunk.map(f => f()))

    }

  }

}

module.exports = exports = exports = Study
