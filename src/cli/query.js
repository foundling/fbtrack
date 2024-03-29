const { parse, parseISO, subDays } = require('date-fns')
const config = require('../config').getConfig({ requiresUserSetup: true });
const { calculateStartAndStopDates } = require('../lib/dates');
const { Database, Study } = require('../models')

async function main({ participantIds=[], all=false, dateRange=[], windowSize=null, chunkSize }) {


  const db = new Database({ databaseName: config.user.STUDY_NAME })
  await db.init()

  const study = new Study({
    name: config.user.STUDY_NAME,
    database: db,
    dataPath: config.app.RAW_DATA_PATH,
    flat: true,
  })

  await study.init()

  const [ dateStart, dateStop ] = calculateStartAndStopDates(dateRange, windowSize);
  const queryOptions = {
    chunkSize,
    participant: {
      ids: participantIds,
      all // boolean flag
    },
    dates: {
      dateStart,
      dateStop,
      windowSize: windowSize,
    }
  }

  const results = await study.query(queryOptions)

}

module.exports = exports = { main }
