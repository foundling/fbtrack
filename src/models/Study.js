const path = require('path')
const fs = require('fs')

const { readdirPromise, statPromise } = require('../lib/utils/io')
const Participant = require('./Participant')

const { APP_CONFIG } = require('../config')

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

        const parts = entry.split(/[._]/)
        const [participantId, date, metric, extension] = parts

        if (!parts.every(Boolean)) {
          // probably a better way to validate that it's a participant file?
          continue
        }
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
      try {
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
      } catch (e) {
        throw e
      }
    }

    return data

  }

  query({ participantIds=[], allParticipants=false, dateRange=[], windowSize=null }) {

  }

}

module.exports = exports = Study
