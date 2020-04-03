const path = require('path')
const fs = require('fs')
const { parseISO, format } = require('date-fns')

const { defaultLogger: logger } = require('../lib/logger')
const { listFormatter } = require('../lib/utils/formatters')
const { dateRangeFromWindowSize, dateRangeFromDateStrings, ymdFormat } = require('../lib/utils/dates')
const { readdirPromise, statPromise } = require('../lib/utils/io')
const { isValidParticipantFilename, parseParticipantFilename } = require('../lib/utils/utils')
const Participant = require('./Participant')

const { APP_CONFIG } = require('../config').getConfig()

// this is basically a interface
const defaultQueryArgs = {
  participant: { ids: null, all: false },
  dates: { range: [], window: null }
}

class Study {

  constructor({ name = '', dataPath = null, flat = false, database = null  } = {}) {

    if (dataPath === null || !fs.existsSync(dataPath)) {
      throw new Error(`Study constructor's 'dataPath' argument can't be null!`)
    }

    this.dataPath = path.isAbsolute(dataPath) ? dataPath : path.join(__dirname, dataPath)
    this.database = database
    this.flat = flat
    this.name = name
    this.participants = null
    this.initialized = false

  }

  async init() {

    this.participants = await this.buildParticipants()
    this.initialized = true

  }

  async buildParticipants() {

    const participants = new Map()
    const participantIdMap = await this.loadDataFromDisk({ dataPath: this.dataPath })
    const participantRecords = await this.database.getParticipants({ active: true }) // maybe allow a filter in study?

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

  async query({ participant={ ids, all }, dates={ range, window } } = defaultQueryArgs) {

    // if ids are there, get list of ids matching current participants,reporting any not matched.
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
    const filteredParticipants = ids.map(id => this.participants.get(id)).filter(Boolean)
    const targetParticipants = all ? this.participants : filteredParticipants

    for (const p of targetParticipants) {

      const [ dateStart, dateStop ] = dates.range.length ?
        dateRangeFromDateStrings({ dates: dates.range }) :
        dateRangeFromWindowSize({
          windowSize: dates.window,
          today: new Date(),
          registrationDate: parseISO(p.record.registrationDate),
        })

      const results = await p.query(dateStart, dateStop)

    }
  }

}

module.exports = exports = exports = Study
