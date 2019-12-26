const fs = require('fs');
const format = require('date-fns/format');
const { promisify } = require('util');

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
    return format(new Date(), 'YYYY-MM-dd:HH:mm:ss')
  }

  async log(msg, level) {

    const header = headers[level]
    console.log(`${header}: ${msg}`)

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

  error(msg)   { return this.log(msg, 'error')   }
  info(msg)    { return this.log(msg, 'info')    }
  warn(msg)    { return this.log(msg, 'warn')    }
  success(msg) { return this.log(msg, 'success') }

}

module.exports = exports = Logger

const logger = new Logger({ logDir: './logs', config: {info: true}})
logger.warn('hi')
logger.info('hi')
logger.success('hi')
logger.error('hi')
