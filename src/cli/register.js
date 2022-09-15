const config = require('../config').getConfig();
const { exec } = require('child_process')
const server = require(config.APP.SERVER_PATH)

function main() {
  server.start(() => {})
}

function openAppInChrome(port) {

    exec(
        `open -a '/Applications/Google Chrome.app' ${`http://localhost:${config.APP.SERVER_PORT}/start`}`, 
        { 'cwd': config.APP.SERVER_PATH }, 
        function(err) { 
            if (err) throw err; 
        }  
    )

}

module.exports = exports = { main, openAppInChrome }
