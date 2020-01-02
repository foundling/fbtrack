const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const {
  DB_PATH,
  AUTH_URI,
  CALLBACK_URL,
  ACCESS_TOKEN_URI,
  CLIENT_ID,
  CLIENT_SECRET,
  DEFAULT_WINDOW_SIZE,
  FITBIT_ENDPOINTS,
  RESPONSE_TYPE,
  SCOPE,
} = process.env

module.exports = {
  STUDY_NAME: 'ACT',
  PATHS: {
    DB_NAME: 'fbtrack.sqlite',
    DB_PATH: path.join(__dirname, './db'),
    DATA_PATH: path.join(__dirname, './data'),
    LOGS_PATH: path.join(__dirname, './data'),
  },
  OAUTH: {
    AUTH_URI,
    CALLBACK_URL,
    ACCESS_TOKEN_URI,
    CLIENT_ID,
    CLIENT_SECRET,
    DEFAULT_WINDOW_SIZE,
    RESPONSE_TYPE,
    FITBIT_ENDPOINTS: require('./fitbit_endpoints.json'),
    SCOPE,
  },
  SERVER: {
    PORT: 3000
  }
}
