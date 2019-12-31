require('dotenv').config()

const { SERVER_PATH } = process.env
const { exec } = require('child_process')
const server = require(SERVER_PATH)

function main() {
  server.start(() => {})
}

function openAppInChrome(port) {

    exec(
        `open -a '/Applications/Google Chrome.app' ${`http://localhost:${port}/start`}`, 
        { 'cwd': SERVER_PATH }, 
        function(err) { 
            if (err) throw err; 
        }  
    )

}

module.exports = exports = { main, openAppInChrome }
