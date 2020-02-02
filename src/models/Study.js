const path = require('path')
const fs = require('fs')

const { defaultLogger: logger } = require('../lib/logger')
const { listFormatter } = require('../lib/utils/formatters')
const { readdirPromise, statPromise } = require('../lib/utils/io')
const { isValidParticipantFilename, parseParticipantFilename } = require('../lib/utils/utils')
const Participant = require('./Participant')

const { APP_CONFIG, USER_CONFIG } = require('../config')

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

      participants.set(
        record.participantId,
        new Participant({
          record,
          files: participantIdMap.get(record.participantId) || [],
        })
      )

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

    // if ids are there, get list of ids that match, report mismatched.
    // if all flag is there, use participant ids we have

    const { ids, all }  = participant
    const missing = all ? [] : ids.filter(id => !this.participants.has(id))
    if (missing.length) {
      const makeList = listFormatter('•')
      const missingList = logger.warn(`The following participants were queried but are not in the database: \n${makeList(missing)}`)
    }

    const targetParticipants = all ? this.participants : ids.filter(id => this.participants.has(id)).map(id =>
      this.participants.get(id))
    console.log(targetParticipants)
    // considerations: what to return from query, and when to write the results.
    // can we prevent large build up of file content in memory?
    //
    // i want to:
    //   take a query from the cli interface
    //   query for all the matching results
    //   get results back as they come in
    //   write them out
    //   keep track of

    // participants
    // what happens here?
    // warm up database, create study object from db, use participants object on study.
    // study.query()
    // gets you fitbit json data for participants with dates matching the query criteria
    // wait till you have all data before reporting results, but if stuff isn't locally available,
    // fetch the metrics for the participant.
    //   - make sure to 'flatten' the request format from an array of metric query arrays into an array of metric queries
    //   - this makes it so that none of the requests from each participant id metric blocks any other

  }

}

module.exports = exports = Study
