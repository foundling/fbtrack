require('dotenv').config()

const path = require('path')
const {
  CLIENT_ID,
  CLIENT_SECRET,
  DEFAULT_WINDOW_SIZE,
  FITBIT_ENDPOINTS,
} = process.env

module.exports = {
  DB_NAME: 'fbtrack.sqlite',
  DB_PATH: path.join(__dirname,'./db'),
  DATA_PATH: path.join(__dirname, './data'),
  LOGS_PATH: path.join(__dirname, './data'),
  CLIENT_ID,
  CLIENT_SECRET,
  DEFAULT_WINDOW_SIZE,
  FITBIT_ENDPOINTS: require('./fitbit_endpoints.json')
}
