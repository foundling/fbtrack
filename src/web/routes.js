const qs = require('querystring')
const {
  FITBIT_CONFIG,
  APP_CONFIG,
  USER_CONFIG,
} = require('../config')

const FitBitApiClient = require('fitbit-node')
const { format } = require('date-fns')
const Database = require(APP_CONFIG.DB_PATH)

const db = new Database({ databaseFile: APP_CONFIG.DB_NAME })
const client = new FitBitApiClient({
  clientId: FITBIT_CONFIG.CLIENT_ID,
  clientSecret: FITBIT_CONFIG.CLIENT_SECRET
})
const { defaultLogger: logger } = require('../lib/logger')

const {
  dates
} = require('../lib/utils')

const {
  ymdFormat
} = dates 

const index = (req, res) => {
  res.render('index', {
    layout: 'main.hbs',
    studyName: USER_CONFIG.STUDY_NAME
  })
};

const authorize = async (req, res) => {

  const { participantId } = req.query
  let participant

  if (!participantId) {
    return res.status(400).send({ errorMessage: 'Bad request. No participant id.' })
  }

  try {

    participant = await db.getParticipantById(participantId)

  } catch(e) {

    throw e;
    return res.setStatus(500).end()

  }

  if (participant) {

    return res.status(409).send({ errorMessage: 'This participant id already exists in the database.' })

  }

  try {

    /* let front-end client perform redirect to fibit. if redirecting via ajax response,
       it's a cross-domain request, which fitbit blocks. */

    const state = qs.encode({ participantId })
    const prompt = 'login consent'
    const redirectURI = client.getAuthorizeUrl(FITBIT_CONFIG.SCOPE, FITBIT_CONFIG.CALLBACK_URL, prompt, state)

    await res.json({ data: { redirectURI } })

  } catch(e) {

    throw e
    await res.json({ errorMessage: e })

  }
}

async function addParticipant(req, res) {

  const { code, state } = req.query;
  const { participantId } = qs.decode(state)
  const error = req.query.error_description;
  const todaysDate = format(new Date(), ymdFormat);

  if (error) {

    logger.error(`Error receiving auth tokens`)
    return res.render('signup_status', { layout: 'main.hbs', error: e })

  }

  let tokens

  try {

    tokens = {
      access_token,
      refresh_token
    } = await client.getAccessToken(code, FITBIT_CONFIG.CALLBACK_URL)

  } catch(e) {

    logger.error(`Error getting access tokens: ${e}`)
    return res.render('signup_status', {
      layout: 'main.hbs',
      error: e
    })

  }
  const newParticipantData = {
    participantId,
    registrationDate: todaysDate,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    isActive: 1,
  }

  try {

    await db.addParticipant(newParticipantData)
    return res.render('signup_status', {
      layout: 'main.hbs',
      participantId
    })

  } catch (e) {

    logger.error(e)
    return res.render('signup_status', {
      error: e,
      layout: 'main.hbs',
    })

  }

};

const stopServer = (req, res) => {

  logger.info('Stopping server ...')
  process.exit()

};

module.exports = exports = {

  index,
  authorize,
  addParticipant,
  stopServer

};
