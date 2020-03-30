const { APP_CONFIG } = require('../config').getConfig();
const { exec } = require('child_process')
const server = require(APP_CONFIG.SERVER_PATH)

function main() {
  server.start(() => {})
}

function openAppInChrome(port) {

    exec(
        `open -a '/Applications/Google Chrome.app' ${`http://localhost:${APP_CONFIG.SERVER_PORT}/start`}`, 
        { 'cwd': APP_CONFIG.SERVER_PATH }, 
        function(err) { 
            if (err) throw err; 
        }  
    )

}

module.exports = exports = { main, openAppInChrome }
