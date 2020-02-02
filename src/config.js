const path = require('path')

const parsedFromConfig = require('dotenv').config({
  path: path.join(__dirname, '..', 'USER_CONFIG.env')
}).parsed

if (!parsedFromConfig) {
  console.log(`Could not locate user config at path: ${path.join(__dirname, '..')}`) 
  process.exit(1)


}

module.exports = {
  USER_CONFIG: {
    CALLBACK_URL,
    CLIENT_ID,
    CLIENT_SECRET,
    SCOPE,
    STUDY_NAME,
    WINDOW_SIZE,
  } = parsedFromConfig,
  APP_CONFIG: {
    DB_NAME: 'fbtrack',
    DB_PATH: path.join(__dirname, 'db'),
    SERVER_PATH: path.join(__dirname, 'web'),
    SERVER_PORT: 3000,
    RAW_DATA_PATH: path.join(__dirname, '../data/raw'),
    LOGS_PATH: path.join(__dirname, '../logs'),
  },
  FITBIT_CONFIG: {
    AUTH_URI: 'https://www.fitbit.com/oauth2/authorize',
    ACCESS_TOKEN_URI: 'https://api.fitbit.com/oauth2/token',
    CALLBACK_URL,
    CLIENT_ID,
    CLIENT_SECRET,
    RESPONSE_TYPE: 'code',
    ENDPOINTS: {
      "sleep":     "/sleep/date/%DATE%.json",
      "activities": "/activities/date/%DATE%.json",
      "activities-calories":  "/activities/calories/date/%DATE%/1d/1min.json",
      "activities-steps":     "/activities/steps/date/%DATE%/1d/1min.json",
      "activities-distance":  "/activities/distance/date/%DATE%/1d/1min.json",
      "activities-heartrate": "/activities/heart/date/%DATE%/1d/1min.json",
    },
    SCOPE,
  },
  SERVER_CONFIG: {
    PORT: 3000
  }
}
