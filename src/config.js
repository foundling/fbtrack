const path = require('path')

const parsedFromConfig = require('dotenv').config({
  path: path.join(__dirname, '..', 'USER_CONFIG.env')
}).parsed

const defaultUserConfig = {
  CALLBACK_URL: 'http://localhost:3000/store_subject_data',
  CLIENT_ID: null,
  CLIENT_SECRET: null,
  SCOPE: null,
  STUDY_NAME: null,
  WINDOW_SIZE: 3,
}

const ENDPOINTS = new Map([
  [ "sleep",                "/sleep/date/%DATE%.json" ],
  [ "activities",           "/activities/date/%DATE%.json" ],
  [ "activities-calories",  "/activities/calories/date/%DATE%/1d/1min.json" ],
  [ "activities-steps",     "/activities/steps/date/%DATE%/1d/1min.json" ],
  [ "activities-distance",  "/activities/distance/date/%DATE%/1d/1min.json" ],
  [ "activities-heartrate", "/activities/heart/date/%DATE%/1d/1min.json" ],
])

function getConfig (requiresUserSetup = false) {

  if (requiresUserSetup && !parsedFromConfig) {
    console.log(`\nERROR: Could not find configuration file ${path.join(__dirname, '..', 'USER_CONFIG.env')}.
If you haven't yet configured fbtrack, please run 'fbtrack configure'.\n`)
    process.exit(1);
  }

  return { 

    USER_CONFIG: {
      CALLBACK_URL,
      CLIENT_ID,
      CLIENT_SECRET,
      SCOPE,
      STUDY_NAME,
      WINDOW_SIZE,
    } = (parsedFromConfig || defaultUserConfig),

    APP_CONFIG: {
      DB_NAME: (parsedFromConfig || defaultUserConfig).STUDY_NAME,
      DB_PATH: path.join(__dirname, 'db'),
      SERVER_PATH: path.join(__dirname, 'web'),
      SERVER_PORT: 3000,
      RAW_DATA_PATH: path.join(__dirname, '../data/raw'),
      LOGS_PATH: path.join(__dirname, '../logs'),
      CHUNK_SIZE: 3,
    },

    FITBIT_CONFIG: {
      AUTH_URI: 'https://www.fitbit.com/oauth2/authorize',
      ACCESS_TOKEN_URI: 'https://api.fitbit.com/oauth2/token',
      CALLBACK_URL,
      CLIENT_ID,
      CLIENT_SECRET,
      RESPONSE_TYPE: 'code',
      ENDPOINTS,
      SCOPE,
    },

    SERVER_CONFIG: {
      PORT: 3000
    }

  }

}

module.exports = { getConfig }
