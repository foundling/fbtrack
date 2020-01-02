const { STUDY_NAME, PATHS, OAUTH, SERVER } = require('../config')

const FitBitApiClient = require('fitbit-node')
const { format } = require('date-fns')
const Database = require(PATHS.DB_PATH)

const db = new Database({ databaseFile: PATHS.DB_NAME })
const client = new FitBitApiClient({ clientId: OAUTH.CLIENT_ID, clientSecret: OAUTH.CLIENT_SECRET })
const Logger = require('../lib/logger')
const logger = new Logger({
  logDir: PATHS.LOGS,
  config: {
    info: false,
    warn: false,
    success: false,
    error: false
  }
})

const { 

  logToUserSuccess, 
  logToUserFail,
  ymdFormat

} = require('../lib/utils') 

const index = (req, res) => {

    /* 
     * Route: '/start'
     *
     * Render start page. Here experimenter adds 
     * subject id and clicks authorize.
     *
     * sends to /authorize route.
     */

    logger.info(`NEW SESSION`)
    logger.info(`New subject registration started.`)

    res.render('index', { layout: 'main.hbs', studyName: STUDY_NAME })

};

const subjectExists = (req, res) => {

  const subjectId = req.query.subjectId

  db.subjectExists(subjectId, (err, exists) => {

      if (err) throw err

      if (exists) {
        logger.error(`subject exists: ${subjectId}`)
      } else {
        logger.info(`Registering new subject with id: ${subjectId}.`)
      }

      res.send(exists)

  });
  
};

const authorize = async (req, res) => {

    /* 
     * Route: '/authorize'
     *
     * - Receive the subject id as a query param,
     *
     * - check if it exists in the database and 
     * throw error if so. 
     *
     *  - otherwise, stache it in the session cache 
     *  and redirect to fb's auth url.
     *
     * note: not saving subject_id here, waiting until 
     * a subject generates valid tokens in later steps.
     *
     */

    logger.info(`path: ${ JSON.stringify(req.query) }`);
    logger.info(`path: ${ req.path }`);

  
    const { participantId } = req.query 

    if (!participantId)
      return res.status(400).send({ errorMessage: 'Bad request. No participant id.' })

    try {

      const participant = await db.getParticipantByParticipantId(participantId)

      if (participant)
        return res.status(404).send({ errorMessage: 'This participant id already exists in the database.' })
      else {

        try {
          // sending whole url back to client, so client can do the redirect instead of server. 
          // seems like something has changed with cors or express or fitbit.
          const redirectURI = client.getAuthorizeUrl(OAUTH.SCOPE, OAUTH.CALLBACK_URL, 'login consent') 
          await res.json({ data: { redirectURI } })
        } catch(e) {
          throw e
        }
      }

    } catch(e) {

        throw e;
        return res.setStatus(500).end()

    }

};

const storeSubjectData = (req, res) => {

    const accessCode = req.query.code;
    const error = req.query.error_description;
    const todaysDate = format(new Date(), ymdFormat);

    logger(`path: ${ req.path }`);

    if (error) {
        logger(`Error receiving auth tokens`);
        return res.render('signup_status', { error });
    }

    client.getAccessToken(accessCode, config.redirectURI).then(function (tokens) {

        const subjectData = { 
            subjectId: db.sessionCache.get('subjectId'), 
            accessToken: tokens.access_token, 
            refreshToken: tokens.refresh_token,
            signupDate: todaysDate
        };

        db.storeSubjectData(subjectData, (error) => { 

            if (error) {
                logger(`error storing auth tokens in the database`);
                return res.render('signup_status', { error }); 
            }

            logger(`
Successfully stored auth tokens in the database for subject with id: ${ db.sessionCache.get('subjectId') }.
access token ends in: ${ tokens.access_token.slice(-8) }
refresh token ends in: ${ tokens.refresh_token.slice(-8) }
            `);

            return res.render('signup_status');
        });

    })
    .catch(function (error) {
        logger(error);
        logToUserFail(error);
        if (error) throw error;
    });

};

const stopServer = (req, res) => {

    logger(`path: ${ req.path }`);
    logger(`stopped server session for subject with id: ${ db.sessionCache.get('subjectId') }`, () => {
        console.log('Stopping the local server ...');
        process.exit(0);
    });

};

module.exports = exports = {

    index,
    authorize,
    subjectExists,
    storeSubjectData,
    stopServer

};
