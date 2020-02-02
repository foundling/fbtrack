const path = require('path')
const fs = require('fs')

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

  }

  async init() {

    this.participants = []

    const participantIdMap = await this.loadDataFromDisk({ dataPath: this.dataPath })
    const participantRecords = await this.database.getParticipants({ active: true }) // maybe allow a filter in study?

    for (const record of participantRecords) {

      const participant = new Participant({
        ...record,
        files: participantIdMap.get(record.participantId) || [],
      })

      this.participants.push(participant)

    }

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

  query({ participant={ ids, all }, dates={ range, window } } = defaultQueryArgs) {

    console.log(participant,dates)
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
