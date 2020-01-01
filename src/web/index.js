const path = require('path')
const express = require('express')
const expressHandlebars = require('express-handlebars')
const bodyParser = require('body-parser')
const cors = require('cors')
const app = express()
const { PATHS, SERVER } = require('../config')
const routes = require('./routes')

app.engine('hbs', expressHandlebars({ defaultLayout: '' }))
app.set('view engine', 'hbs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cors({ origin: `http://localhost:${SERVER.PORT}` }))

// bind routes
app.get('/', routes.index)
/*
app.post('/authorize', routes.authorize)
app.get('/store_subject_data', routes.storeSubjectData)
app.get('/subjectExists', routes.subjectExists)
app.post('/quit', routes.stopServer)
*/

const start = function() {
  app.listen(SERVER.PORT, () => {
    console.log(`Fbtrack Registration Server running at http://localhost:${SERVER.PORT}...`)
  })
}

module.exports = exports = { start }
