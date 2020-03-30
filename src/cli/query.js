const { APP_CONFIG, USER_CONFIG } = require('../config').getConfig();
const Database = require(APP_CONFIG.DB_PATH)
const Study = require('../models/Study')

async function main({ participantIds=null, all=false, dateRange=[], windowSize=null }) {

  const db = new Database({ databaseFile: 'test' })
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
