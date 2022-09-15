const { exec } = require('child_process')
const path = require('path')
const express = require('express')
const { engine } = require('express-handlebars')
const bodyParser = require('body-parser')
const cors = require('cors')

const config = require('../config').getConfig()

const routes = require('./routes')
const { defaultLogger:logger } = require('../lib/logger')

const app = express()

app.engine('hbs', engine({ defaultLayout: 'main' }))
app.set('view engine', 'hbs')
app.set('views', path.join(__dirname, 'views'))
app.set('port', config.app.SERVER_PORT)

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
app.get(`/${config.user.CALLBACK_PATH}`, routes.addParticipant)
app.get('/quit', routes.stopServer)

function start() {

  app.listen(config.app.SERVER_PORT, () => {

    const localUrl = `http://localhost:${app.get('port')}`
    logger.info(`Fbtrack Registration Server running at ${ localUrl }...`)

    exec(
        `open -a '/Applications/Google Chrome.app' ${ localUrl }`,
        { 'cwd': __dirname },
    )

  })

}

module.exports = { start }
