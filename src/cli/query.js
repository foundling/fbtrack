const { APP_CONFIG } = require('../config')
const Database = require(APP_CONFIG.DB_PATH)

async function main({ participantIds=[], all=false, dateRange=[], windowSize=null }) {

  const db = new Database({ databaseFile: DB_NAME })
  await db.init()

  const study = new Study({
    name: STUDY_NAME,
    database: db,
    flat: true, // participant fitbit .json files stored in a single dir
  })

  await study.init({ dataPath: APP_CONFIG.RAW_DATA_PATH })
  await study.query({ 
    participant: { 
      ids: participantIds, 
      all
    },
    dates: {
      range: dateRange,
      window: windowSize
    }
  })

}

module.exports = exports = { main }
