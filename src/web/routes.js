const { PATHS, OAUTH, SERVER } = require('../config')

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
    logger.info(`path: ${ req.path }`)
    logger.info(`New subject registration started.`)
    res.render('index', { layout: 'main.hbs', studyName: 'ACT' })

};

const subjectExists = (req, res) => {

    logger(`path: ${ req.path }`);

    db.subjectExists(req.query.subject_id, (err, exists) => {

        if (err) throw err

        if (exists) {
          logger(`Subject with id has already been registered: ${ req.query.subject_id }.`)
        } else {
          logger(`Registering new subject with id: ${ req.query.subject_id }.`)
        }
        res.send(exists)
    });
    
};

const authorize = (req, res) => {

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

    logger(`path: ${ req.path }`);
    db.sessionCache.set({ subjectId: req.body.subject_id });

    db.fetchAllSubjects((err, rows) => {
        if (err) throw err;

        const subjectIdExists = rows.some(row => row.subject_id === db.sessionCache.get('subject_id'));
        const error = `The subject id ${ db.sessionCache.get('subjectId') } already exists ...`;

        if (subjectIdExists) return res.render('signup_status', { error });
        res.redirect(client.getAuthorizeUrl(config.scope, config.redirectURI, 'login consent'));

    });

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
