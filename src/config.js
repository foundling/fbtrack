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
    WINDOW_SIZE,
    SCOPE,
    STUDY_NAME,
  } = parsedFromConfig,
  APP_CONFIG: {
    DB_NAME: 'fbtrack.sqlite',
    DB_PATH: path.join(__dirname, 'db'),
    SERVER_PATH: path.join(__dirname, 'web'),
    SERVER_PORT: 3000,
    DATA_PATH: path.join(__dirname, '../data'),
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
      "steps":     "/activities/steps/date/%DATE%/1d/1min.json",
      "calories":  "/activities/calories/date/%DATE%/1d/1min.json",
      "distance":  "/activities/distance/date/%DATE%/1d/1min.json",
      "heartrate": "/activities/heart/date/%DATE%/1d/1min.json",
      "activities": "/activities/date/%DATE%.json",
      "sleep":     "/sleep/date/%DATE%.json"
    },
    SCOPE,
  },
  SERVER_CONFIG: {
    PORT: 3000
  }
}
