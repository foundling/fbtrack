const path = require('path')
const fs = require('fs')

const { readdirPromise, statPromise } = require('../lib/utils/io')
const Participant = require('./Participant')

const { APP_CONFIG } = require('../config')

class Study {

  constructor({ name = '', admin = [], participants = [], dataPath = null  } = {}) {

    if (dataPath === null || !fs.existsSync(dataPath)) {
      throw new Error(`Study constructor's 'dataPath' argument can't be null!`)
    }

    this.name = name
    this.participants = participants
    this.admin = admin
    this.dataPath = path.isAbsolute(dataPath) ? dataPath : path.join(__dirname, dataPath)

  }

  async init() {

    const fitbitData = await this.loadDataFromDisk({
      dataPath: this.dataPath,
      flat: false
    })

    //also load data from database here to know which subjects you're looking for
    //const participantInformation = ?? 
  }

  //async query({ by, date, dates }) {}

  async loadFlat({ dataPath }) {
    
  }

  async loadHierarchical({ dataPath }) {
  }

  async loadDataFromDisk({ dataPath, flat }) {

    this.data = await (flat ? this.loadFlat({ dataPath }) : this.loadHierarchical({ dataPath }))

  }

  async loadFlat({ dataPath }) {
    const data = new Map()
    const entries = await readdirPromise(dataPath)
    for (let entry of entries) {
      const entryStat = await statPromise(path.join(dataPath, entry))
      if (entryStat.isFile()) {
        const [participantId, date, metric, extension] = parts = entry.split(/[._]/)
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

  async loadHierarchical({ dataPath }) {
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
}

module.exports = exports = Study
