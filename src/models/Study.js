const path = require('path')

const { readdirPromise, statPromise } = require('../lib/utils/io')
const Participant = require('./Participant')

const { APP_CONFIG } = require('../config')

class Study {

  constructor({ name = '', admin = [], participants = []  } = {}) {

    this.name = name
    this.participants = participants
    this.admin = admin

  }

  async init({ dataPath }) {
    const data = await this.loadDataFromDisk({ dataPath, flat: false })
    //also load data from database here to know which subjects you're looking for
  }

  //async query({ by, date, dates }) {}

  async loadFlat({ dataPath }) {
    
  }

  async loadHierarchical({ dataPath }) {
  }

  async loadDataFromDisk({ dataPath, flat }) {

    const data = await (flat ? this.loadFlat({ dataPath }) : this.loadHierarchical({ dataPath }))

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

const s = new Study()
s.init({ dataPath: APP_CONFIG.RAW_DATA_PATH }).then(console.log)

module.exports = exports = Study
