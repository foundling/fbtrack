const { exec } = require('child_process')
const path = require('path')
const express = require('express')
const expressHandlebars = require('express-handlebars')
const bodyParser = require('body-parser')
const cors = require('cors')
const { PATHS, SERVER } = require('../config')
const routes = require('./routes')
const Logger = require('../lib/logger')

const logger = new Logger({ logDir: PATHS.LOGS })

const app = express()
app.engine('hbs', expressHandlebars({ defaultLayout: 'main' }))
app.set('view engine', 'hbs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cors())
app.use((req, res, next) => {
  logger.info('\n')
  logger.info(`path: ${req.path}`)
  logger.info(`query params: ${JSON.stringify(req.query)}`)
  logger.info('\n')
  next()
})

// bind routes
app.get('/', routes.index)
app.post('/authorize', routes.authorize)
app.get('/store_subject_data', routes.addParticipant)
/*
app.post('/quit', routes.stopServer)
*/

function start() {

  app.listen(SERVER.PORT, () => {

    // logger
    console.log(`Fbtrack Registration Server running at http://localhost:${SERVER.PORT}...`)
    const localUrl = `http://localhost:${SERVER.PORT}`

    exec(
        `open -a '/Applications/Google Chrome.app' ${ localUrl }`,
        { 'cwd': __dirname }, 
    )

  })

}

module.exports = { start }
