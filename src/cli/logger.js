const { APP_CONFIG} = require('../config')

const Logger = require('../lib/logger')

modules.export = new Logger({
  logDir: APP_CONFIG.LOGS_PATH,
  config: {
    info: false,
    warn: false,
    error: false,
    success: false
  }
})


