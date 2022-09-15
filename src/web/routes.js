const qs = require('querystring')
const config = require('../config').getConfig({ requiresUserSetup: true })

const FitBitApiClient = require('fitbit-node')
const { format } = require('date-fns')
const Database = require('../models/Database')

const db = new Database({ databaseName: config.app.DB_NAME })
const client = new FitBitApiClient({
  clientId: config.fitbit.CLIENT_ID,
  clientSecret: config.fitbit.CLIENT_SECRET
})
const { defaultLogger: logger } = require('../lib/logger')

const { dates } = require('../lib')

const {
  ymdFormat
} = dates

const index = (req, res) => {
  res.render('signup', {
    layout: 'main.hbs',
    studyName: config.user.STUDY_NAME
  })
};

const authorize = async (req, res) => {

  const {
    participantId,
    participantStartDate,
    reauthorize,
  } = req.query

  let participant

  if (!participantId) {
    return res.status(400).send({ errorMessage: 'Bad request. No participant id.' })
  }

  try {

    await db.init()
    participant = await db.getParticipantById(participantId)

  } catch(e) {

    throw e;
    return res.setStatus(500).end()

  }

  if (participant && !reauthorize) {

    return res.status(409).send({ errorMessage: 'This participant id already exists in the database.' })

  }

  try {

    /* let front-end client perform redirect to fibit. if redirecting via ajax response,
       it's a cross-domain request, which fitbit blocks. */

    const state = qs.encode({ participantId, participantStartDate })
    const prompt = 'login consent'
    const redirectURI = client.getAuthorizeUrl(config.fitbit.SCOPE, config.fitbit.CALLBACK_URL, prompt, state)

    await res.json({ data: { redirectURI } })

  } catch(e) {

    throw e
    await res.json({ errorMessage: e })

  }
}

async function addParticipant(req, res) {

  const { code, state } = req.query;
  const { participantId, participantStartDate } = qs.decode(state)
  const error = req.query.error_description;

  if (error) {

    logger.error(`Error receiving auth tokens`)
    return res.render('signup_status', { layout: 'main.hbs', error: e })

  }

  let tokens

  try {

    tokens = {
      access_token,
      refresh_token
    } = await client.getAccessToken(code, config.fitbit.CALLBACK_URL)

  } catch(e) {

    logger.error(`Error getting access tokens: ${e}`)
    logger.debug(e)
    return res.render('signup_status', {
      layout: 'main.hbs',
      error: e
    })

  }
  const newParticipantData = {
    participantId,
    registrationDate: participantStartDate,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    isActive: 1,
  }

  try {

    await db.addParticipant(newParticipantData)
    const newParticipant = db.getParticipantById(participantId)

    logger.info(`Participant Record Created: ${JSON.stringify(newParticipant, null, 2)}`)

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

  res.render('server_shutdown', {
    layout: 'main.hbs',
  });

  setTimeout(() => {
    process.exit()
  }, 1000);

};

module.exports = exports = {

  index,
  authorize,
  addParticipant,
  stopServer

};
