const { APP_CONFIG} = require('../config')
const fs = require('fs');
const format = require('date-fns/format');
const { inspect, promisify } = require('util');

const colors = require('colors/safe');
const writeFilePromise = promisify(fs.writeFile);

const headers = {
  'error': colors.red('error'),
  'warn': colors.yellow('warn'),
  'info': colors.blue('info'),
  'success': colors.rainbow('success')
}

class Logger {

  constructor({ logDir, config = { error: false, warn: false, info:false, success:false } }) {

    this.logDir = logDir
    this.config = config

  }

  timestamp () {
    return format(new Date(), 'yyyy-MM-dd:HH:mm:ss')
  }

  async log(msg, level) {

    const header = headers[level]
    const unpackedMsg = typeof msg === 'string' ? msg : inspect(msg, {depth: null})
    console.log(`${header}: ${unpackedMsg}`)

    if (this.config[level]) {
      await this.toDisk({ 
        path: `${this.logDir}/${level}.log`, 
        msg: `${this.timestamp()}: fbtrack ${level}: ${msg}`
      })
    }

  }

  async toDisk({ path, msg }) {
    try {
      await writeFilePromise(path, msg)
    } catch(e) {
      throw new Error(e)
    }
  }

  async debug(o) {
    await this.log(
      'DEBUG: ', 
      JSON.stringify(o, null, 2)
    )
  }

  error(msg)   { return this.log(msg, 'error')   }
  info(msg)    { return this.log(msg, 'info')    }
  warn(msg)    { return this.log(msg, 'warn')    }
  success(msg) { return this.log(msg, 'success') }

}

const defaultLogger = new Logger({
  logDir: APP_CONFIG.LOGS_PATH,
  config: {
    info: false,
    warn: false,
    error: false,
    success: false
  }
})


module.exports = exports = { 
  Logger, 
  defaultLogger
}
