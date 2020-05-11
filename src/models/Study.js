const path = require('path')
const fs = require('fs')
const { format, parseISO, differenceInDays } = require('date-fns')
const { cursorTo } = require('readline')

const { isValidParticipantFilename, parseParticipantFilename } = require('../lib/utils')
const { defaultLogger: logger } = require('../lib/logger')
const { listFormatter } = require('../lib/formatters')
const {
  datesWithinBoundaries,
  dateBoundariesFromWindowSize,
  dateBoundariesFromDates,
  ymdFormat,
} = require('../lib/dates')

const {
  readdirPromise,
  statPromise
} = require('../lib/io')

const Participant = require('./Participant')

const {
  APP_CONFIG,
  FITBIT_CONFIG,
  USER_CONFIG,
} = require('../config').getConfig({ requiresUserSetup: true })

const defaultQueryArgs = {
  participant: { ids: [], all: false },
  dates: { range: [], window: null },
  chunkSize: APP_CONFIG.CHUNK_SIZE,
}

const makeList = listFormatter('•')

class QueryStats {

  constructor() {

    this.participants = new Map()

  }

  addParticipant({ participantId, dates, metrics }) {

    // in: dates are objects
    this.participants.set(participantId, new Map())

    for (const date of dates) {

      const dateAsKey = format(date, ymdFormat)

      this.participants
        .get(participantId)
        .set(dateAsKey, new Map())

      for (const metric of metrics) {

        this.participants
          .get(participantId)
          .get(dateAsKey)
          .set(metric, new Map([
            [ 'collected', false ],
            [ 'error', undefined ]
          ]))

      }
    }

  }

  updateParticipantStats({ participantId, date, metric, collected, error }) {

    this.participants.get(participantId).get(date)
      .get(metric)
      .set('collected', collected)
      .set('error', error)

  }

  get progress() {

    let total = 0;
    let current = 0;

    for (const [ id, participantDates ] of this.participants) {

      let errorsCollected = 0
      let metricsCollected = 0

      const metricsExpected = participantDates.size * FITBIT_CONFIG.ENDPOINTS.size

      for (const [date, metrics] of participantDates) {

        for (const [metric, collectionInfo] of metrics) {

          ++total

          if (collectionInfo.get('collected')) {
            ++current
          }

        }

      }

    }

    return `${ Math.floor(current/total * 100) }%`

  }

  get stats() {

    const header = 'Fbtrack Collection Summary:\n'
    let lines = []

    for (const [ id, participantDates ] of this.participants) {

      let errorsCollected = 0
      let metricsCollected = 0
      const metricsExpected = participantDates.size * FITBIT_CONFIG.ENDPOINTS.size

      for (const [date, metrics] of participantDates) {
        for (const [metric, collectionInfo] of metrics) {

          if (collectionInfo.get('collected')) {
            metricsCollected += 1
          } else if (collectionInfo.get('error')) {
            errorsCollected += 1
          }

        }
      }

      const nextLine = [
        `participant id: ${id}`,
        `collected: ${metricsCollected}/${metricsExpected}`,
        `errors encountered: ${errorsCollected}`,
      ].join(' | ')

      lines.push(nextLine)

    }

    return `${header}${makeList(lines)}`

  }

  get errors() {

    const errors = []

    for (const [ id, dates ] of this.participants) {
      for (const [ date, metrics ] of dates) {
        for (const [ metric, collectionInfo ] of metrics) {
          if (collectionInfo['error']) {
            errors.push(`Error: ${id} | ${date} | ${metric} | ${error}\n`)
          }
        }
      }
    }

    return (errors.length > 0) ?
      `\nErrors: ${ errors.length } errors occurred:\n${ errors.join('\n') }` : 
      ''

  }

  rerender() {

    cursorTo(process.stdout, 0);
    process.stdout.write(`fbtrack query progress: ${ this.progress }`)

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

    if (range.length > 0) {
      return dateBoundariesFromDates({ 
        dates: range,
        registrationDate: parseISO(registrationDate) 
      })
    }

    return dateBoundariesFromWindowSize({
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
    const queryStats = new QueryStats()

    targetParticipants.forEach(participant => {

      const [ dateStart, dateStop ] = this.calculateDateBoundaries({
        range: dates.range,
        window: dates.window,
        registrationDate: participant.record.registrationDate
      })

      queryStats.addParticipant({
        participantId: participant.participantId,
        dates: datesWithinBoundaries(dateStart, dateStop),
        metrics: [...FITBIT_CONFIG.ENDPOINTS.keys()],
      })

      participantQueryFns.push(
        async () => {
          for await (const stats of participant.query(dateStart, dateStop)) {

            queryStats.updateParticipantStats(stats)
            queryStats.rerender()

          }
        }
      )

    })

    await this.runConcurrently(participantQueryFns, chunkSize)

    process.stdout.write(`\n${queryStats.stats}\n${queryStats.errors}`)

  }

  async runConcurrently(funcs, chunkSize=1) {

    while (funcs.length > 0) {

      const chunk = funcs.splice(0, chunkSize)
      await Promise.all(chunk.map(f => f()))

    }

  }

}

module.exports = exports = exports = Study
