const util = require('util')  
const { exec } = require('child_process')
const execPromise = util.promisify(exec)

async function main() {

  const cmd = `open -a '/Applications/Google Chrome.app' http://status.fitbit.com`
  try {
    await exec(cmd)
  } catch (e) {
    throw e
  }

}

module.exports = exports = { main };
