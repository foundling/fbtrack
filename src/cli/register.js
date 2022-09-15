const config = require('../config').getConfig();
const { exec } = require('child_process')
const server = require(config.app.SERVER_PATH)

function main() {
  server.start(() => {})
}

function openAppInChrome(port) {

    exec(
        `open -a '/Applications/Google Chrome.app' ${`http://localhost:${config.app.SERVER_PORT}/start`}`, 
        { 'cwd': config.app.SERVER_PATH }, 
        function(err) { 
            if (err) throw err; 
        }  
    )

}

module.exports = exports = { main, openAppInChrome }
