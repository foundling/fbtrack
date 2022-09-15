const config = require('../config').getConfig();
const fs = require('fs');
const format = require('date-fns/format');
const { inspect, promisify } = require('util');

const colors = require('colors/safe');
const writeFilePromise = promisify(fs.writeFile);

const headers = {
  'debug': colors.gray('debug'),
  'error': colors.red('error'),
  'warning': colors.yellow('warning'),
  'info': colors.blue('info'),
  'success': colors.rainbow('success'),
  undefined: '',
}

class Logger {

  constructor({ logDir, label = false, config = { debug: false, error: false, warn: false, info: false, success: false } }) {

    this.logDir = logDir
    this.config = config
    this.label = label

  }

  nowISO() {
    return format(new Date(), 'yyyy-MM-dd:HH:mm:ss')
  }

  log(msg, { bold, underline }) {
    console.log(msg)
  }

  async flog(msg, level) {

    const unpackedMsg = typeof msg === 'string' ? msg : inspect(msg, {depth: null})
    console.log(`${level}: ${unpackedMsg}`)

    if (this.config[level]) {
      await this.toDisk({ 
        path: `${this.logDir}/${level}.log`, 
        msg: `${this.nowISO()}: fbtrack ${level}: ${msg}`
      })
    }

  }

  async _log(msg, level) {

    const header = this.label ? `${headers[level]}: ` : ''
    const unpackedMsg = typeof msg === 'string' ? msg : inspect(msg, {depth: null})
    console.log(`${header} ${unpackedMsg}`)

  }

  log(msg, { bold, underline }) {

    let output = msg
    if (bold) {
      output = colors.bold(output)
    }
    if (underline) {
      output = colors.underline(output)
    }

    console.log(output)

  }

  async toDisk({ path, msg }) {
    try {
      await writeFilePromise(path, msg)
    } catch(e) {
      throw new Error(e)
    }
  }

  async debug(o) {
    await this._log(JSON.stringify(o, null, 2), 'debug')
  }

  error(msg)   { return this._log(msg, 'error')   }
  info(msg)    { return this._log(msg, 'info')    }
  warn(msg)    { return this._log(msg, 'warning')    }
  success(msg) { return this._log(msg, 'success') }

}

const defaultLogger = new Logger({
  logDir: config.app.LOGS_PATH,
  label: true,
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
