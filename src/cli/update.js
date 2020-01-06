require('dotenv').config()

const { exec } = require('child_process')
const { debug } = require('./utils')

function main() {

    exec(
        'git pull',
        { 'cwd': __dirname }, 
        function(err, stdout, stderr) {
            if (err) throw err
            console.log(stdout || stderr)
            // replace with logger
            debug(`Don't forget to manually copy over the config.js file if it has been updated.`)
            debug(`Don't forget to make sure any new directories you might have added or changed the names of are present.`)
        }
    )

}

module.exports = exports = { main }
