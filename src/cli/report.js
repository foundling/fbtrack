const { parseISO } = require('date-fns')
const { groupBy } = require('lodash')
const logger = require('../lib/logger')
const { APP_CONFIG } = require('../config')
const { 
  DB_PATH,
  DB_FILENAME,
  RAW_DATA_PATH 
} = APP_CONFIG

const { 

    dateRE, 
    dateNotIn,
    dateComparator,
    generateDateRange, 
    logToUserSuccess, 
    logToUserInfo, 
    toDateString,
    isRawDataFile,
    includesDate,
    readFilePromise,
    readdirPromise,

} = require('../lib/utils');

const Database = require(DB_PATH);
const db = new Database({ databaseFile: DB_FILENAME });

const metrics = [
  'steps',
  'calories',
  'distance',
  'heartrate',
  'activities',
  'sleep'
]

module.exports = exports = {

  main: async function() {

    const filenames = await readdirPromise(RAW_DATA_PATH)
    const participants = await db.getParticipants()

    // figure out canonical path structure!!!
    const filesById = groupBy(filenames, s => s.split('_')[0])
    Object.keys(filesById).forEach(id => {
      filesById[id].sort((a,b) => {
        return new Date(b) - new Date(a)
      })
    })


    // memo of participantId to sorted array dates as well as registration date
 
    const participantMap = new Map()
    for (let { participantId, registrationDate } of participants) {

      participantMap.set(participantId, {
        files: filesById[participantId],
        registrationDate,
      }

    }

    for (let [participantId, { files, registrationDate }] of participantMap) {

      logger.info(`${participantId}`)

      for (let metric of metrics) {
        logger.info(`\t${metric}`)
        const 
        if (metric 
      }

    }
    // filter files to those that contain a valid subject id
    // match against some criteria
    // cache by subjectId
    // 



  }

};
