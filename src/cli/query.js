const { parseISO } = require('date-fns')
const { 
  APP_CONFIG,
  USER_CONFIG
} = require('../config').getConfig({ requiresUserSetup: true });

const { Database, Study } = require('../models')

async function main({ participantIds=[], all=false, dateRange=[], windowSize=null, chunkSize }) {

  const db = new Database({ databaseName: USER_CONFIG.STUDY_NAME })
  await db.init()

  if (dateRange.length === 0 && windowSize == null) {
    windowSize = Number(USER_CONFIG.WINDOW_SIZE)
  }

  const study = new Study({
    name: STUDY_NAME,
    database: db,
    dataPath: APP_CONFIG.RAW_DATA_PATH,
    flat: true, // participant fitbit .json files stored in a single dir
  })

  await study.init()

  const queryOptions = {
    chunkSize,
    participant: {
      ids: participantIds,
      all // boolean flag
    },
    dates: {
      range: dateRange.map(parseISO), // [start date, stop date], [] and [start date] are ok.
      window: windowSize // increasing dates starting windowSize # days before yesterday
    }
  }

  const results = await study.query(queryOptions)

}

module.exports = exports = { main }
