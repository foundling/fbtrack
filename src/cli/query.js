const { APP_CONFIG, USER_CONFIG } = require('../config').getConfig({ requiresUserSetup: true });
const Database = require(APP_CONFIG.DB_PATH)
const Study = require('../models/Study')

async function main({ participantIds=[], all=false, dateRange=[], windowSize=null, chunkSize=APP_CONFIG.CHUNK_SIZE }) {

  const db = new Database({ databaseFile: USER_CONFIG.STUDY_NAME })
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
    concurrency: chunkSize,
    participant: {
      ids: participantIds,
      all // boolean flag
    },
    dates: {
      range: dateRange, // [start date, stop date], [] and [start date] are ok.
      window: windowSize // increasing dates starting windowSize # days before yesterday
    }
  }

  const results = await study.query(queryOptions)

}

module.exports = exports = { main }
