require('dotenv').config() 

const {
  CLIENT_ID,
  CLIENT_SECRET,
  LOGS_PATH,
  DB_PATH,
  DATA_PATH
} = process.env


const fs = require('fs');
const util = require('util');
const moment = require('moment');

const readdirPromise = util.promisify(fs.readdir);
const writeFilePromise = util.promisify(fs.writeFile);
const Logger = require('./logger');
const logger = new Logger({
  logDir: LOGS_PATH,
  config: {
    info: false,
    warn: false,
    error: false,
    success: false
  }
});

const { 

    compact,
    dateRE, 
    dateNotIn,
    debug, 
    debugExit, 
    errorCallback, 
    generateQueryPaths,
    generateDateRange,
    inDateRange,
    matchesSubjectId,
    parseDateRange,
    toDateString,
    toHeartRateMetric,
    ymdFormat, 

} = require('./utils');

const isValidDataset = (day) => !!day['activities-heart-intraday'].dataset.length;
const toStatusCodeString = (day) => day[1][1].statusCode.toString();
const isErrorResponse = (day) => day.some(metric => metric[0].errors);
const isDataResponse = (day) => day.some(metric => metric[0]['activities-heart-intraday']);
const isClientError = (statusCode) => statusCode.startsWith('4');

const { logErrors } = require('./reporting/queryMonitor');

const FitBitClient = require('fitbit-node');
const fbClient = new FitBitClient({ 
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET
});

const Database = require(DB_PATH);
const db = new Database({ databaseFile: 'fbtest' });
const commandOptions = { windowSize: null };
const todaysDateString = moment().format(ymdFormat);


function preQueryCheck(subjectData) {

    if (!subjectData)
        return logToUserFail(`This subject id is not in the database.`);

    if (subjectData.signupDate === todaysDateString) {
        logToUserSuccess(`Subject ${subjectData.subjectId} was signed up today. No need to query.`);  
        process.exit(0);
    }

    getFilenames(subjectData);

}

async function getFilenames({ filter, directory }) {

    try {
      const filenames = await readdirPromise(directory)
      const participantFiles = filenames.filter(filter)
    } catch (e) {
      throw new Error(e);
    }

    return participantFiles
}

function getDateBoundaries(signupDateString, windowSize, dateRange) {

    if (dateRange) {
        return { 
            startDate: moment(dateRange[0]), 
            stopDate: moment(dateRange[1]) 
        };
    }

    let yesterday = moment().subtract({ days: 1 });
    let signupDate = moment(signupDateString);
    let defaultStartDate = yesterday.clone().subtract({ days: windowSize });
    let startDate = signupDate > defaultStartDate ? signupDate : defaultStartDate;   
    let stopDate = yesterday.clone();

    return { startDate, stopDate };

}

const findUncapturedDates = (startDate, stopDate, allDatesCaptured) => {

    const startDateString = startDate.format(ymdFormat);
    const stopDateString = stopDate.format(ymdFormat);

    const idealDateRange = generateDateRange(startDateString, stopDateString);
    const capturedDatesInRange = allDatesCaptured.filter( inDateRange({start: startDateString, end: stopDateString}) );
    const uncapturedDatesInRange = idealDateRange.filter( dateNotIn(capturedDatesInRange) );

    return uncapturedDatesInRange;

};

function buildQueryPaths(dates) {

    if (!dates.length) {
        logToUserSuccess(`No requests necessary for subject ${ db.sessionCache.get('subjectId') }. All data collected in this date window`);
        process.exit(0);
    }
    const queryPaths = generateQueryPaths(dates);
    

    toPromiseArray(queryPaths);
}

function extractFitBitData(days) {
    // need to take metrics for each day and flatten them into a single object

    return days.map(day => {

        // flatten subarray metrics for each day into a single object.
        return day
            .reduce((o, metric) => {
                 Object
                    .keys(metric[0])
                    .forEach(key => {
                        o[key] = metric[0][key]; 
                    });
                return o;
            }, {});
    });  

}

/* 
 * Query Functions / Async Control Flow 
 */

async function main(participantId, { windowSize=3, dates=[], refresh=false }) {

    await db.init()

    // get participant by id
    try {
      const participant = await db.getParticipantByParticipantId(participantId)
      console.log(participant)
      if (!participant) {
          await logger.error(`subject [ ${ participantId } ] is not in the database.`);
          return
      }
      // don't run if they signed up today
      if (participant.registration_date === today()) {
        await logger.success(`Subject ${ participant } was signed up today. No data to query.`);  
        return
      }
    } catch (e) {
      throw new Error(e)
    }


    // refresh token if needed -- add prop .refreshed to main? check against that?
    if (refresh) {
      await logger.info(`Running Fbtrack for subject ${participantId}`);
      try {
        const accessToken = await refreshAccessToken(participant)
      } catch(e) {
        throw new Error(e)
      }
    }

    try {

      const filenames = await getFilenames({ 
        filter: fname => fname.startsWith(participantId),
        directory: DATA_PATH 
      })

      let dateRange

      if (dates.length === 1)
        dateRange = [dates[0], date[0]]
      else if (dates.length === 2)
        dateRange = dates

      const datesRequired = getDateBoundaries(participant.signup_date, windowSize, dateRange) 
      const capturedDates = filenames.map(toDateString)
      const missingDates = datesRequired.filter(date => !capturedDates.includes(date))

    } catch (e) {
      throw new Error(e)
    }

  /*
    let dateRange
    if (dates.length 
        dateRange = dates.length === 1 ? [commandOptions.dates[0], commandOptions.dates[0]] : commandOptions.dates;
                          
    const { startDate, stopDate } = getDateBoundaries(
        subjectData.signupDate,
        commandOptions.windowSize,
        dateRange
    ); 

    const uncapturedDates = findUncapturedDates(startDate, stopDate, allDatesCaptured); 

    buildQueryPaths(uncapturedDates);
    */


    
    // todo: flatten to 2d
    //const pathsByDate = dates.map(date => metrics.map(metric => makeRequest({ date, metric })))

}

async function restartQuery({ subjectId }) {

    if (!subjectId) {
        await logger.error(subjectId);
        throw new Error(`Trying to restart query after token refresh, but have no subject id!`);
    }

    /* runs when acess token needs to be refreshed */
    db.fetchOneSubject(subjectId, (err, subjectData) => {
        if (err) throw err;
        preQueryCheck(subjectData);
    });

}

function toPromiseArray(queryPaths) {

    const requestGroups = queryPaths.map(queryPath => { 
        return queryPath.map(path => {
            return fbClient.get(path, db.sessionCache.get('accessToken')); 
        });
    });

    queryAPI(requestGroups);

}

async function queryAPI(requestGroups) {

    await logger.info(`Requesting the following data from the FitBitAPI: [ ${ colors.white( config.scope.split(',').join(', ') ) } ].`); 

    Promise.all(requestGroups.map(requestGroup => Promise.all(requestGroup)))
        .then(handleAPIResponse, async (e) => { return await logger.info(e); })
        .catch(async (e) => { await logger.info('Something went wrong with the fitbit API query ... ', e); });

}

function handleAPIResponse(responseGroups) {

    const subjectId = db.sessionCache.get('subjectId');
    const signupDate = db.sessionCache.get('signupDate');

    const statusCodeStrings = responseGroups.map(toStatusCodeString);
    const errorResponses = responseGroups.filter(isErrorResponse);
    const dataResponses = responseGroups.filter(isDataResponse);
    const validDatasets = extractFitBitData(dataResponses).filter(isValidDataset); 

  /*
    logger.info(`Status codes from request for subject ${ subjectId }: ${ colors.white(statusCodeStrings.join(',')) }.`);
    logger.info(`# valid datasets: ${ colors.white(validDatasets.length) }.`);
    logger.info(`# errors: ${ colors.white(errorResponses.length) }.`);
    */

    // this callback runs when all datasets are written. It runs regardless if there are datasets or not.
    writeDatasetsToFiles(subjectId, validDatasets, (err) => { 
        if (err) throw err; 
        handleClientErrors(errorResponses.map(toStatusCodeString), refreshAccessToken);
    });

}

function handleClientErrors(clientErrorCodes, refreshCallback) {

    const tokenExpired = (errorCode) => errorCode === '401';
    const rateLimitExceeded = (errorCode) => errorCode === '429';
    const isNotRefreshError = (errorCode => errorCode.startsWith('4') && errorCode !== '401');

    const handleExpiredAuthToken = () => {

        logger.info(`Access Token for subject ${ db.sessionCache.get('subjectId') } has expired. Refreshing tokens ... `);

        db.fetchOneSubject(db.sessionCache.get('subjectId'), (err, subjectData) => {
            if (err) throw err;
            refreshCallback(subjectData);
        });

    };

    const errorsToLog = clientErrorCodes.filter(isNotRefreshError);
    const needsRefresh = clientErrorCodes.some(tokenExpired);

    if (needsRefresh) handleExpiredAuthToken();
    if (errorsToLog.length) logErrors(db.sessionCache.get('subjectId'), errorsToLog);

}

function refreshAccessToken(subjectData) {

    if (refreshAccessToken.called) {
        logger.error(`Unexpected multiple token refresh attempts. Exiting ...`); 
        process.exit(1);
    } 
    refreshAccessToken.called = true;

    fbClient
        .refreshAccessToken(subjectData.accessToken, subjectData.refreshToken, 3600)
        .then(updateTokens)
        .catch(e => {
            logger.error(`Token update failed. Error details: ${ JSON.stringify(e.context.errors[0]) }`);
        });
}

function updateTokens({ access_token, refresh_token }) {

    const newTokens = {
        accessToken: access_token,
        refreshToken: refresh_token
    };

    if ( ! (newTokens.accessToken && newTokens.refreshToken) ) {
        throw new Error(`Trying to replace token with null data! ${ newTokens }. Exiting ...`);
    }

    db.updateTokens(newTokens, (err) => {
        if (err) throw err;
        restartQuery({ subjectId: db.sessionCache.get('subjectId') });
    });

}

function writeDatasetsToFiles(subjectId, datasets, nextCb) {

    if (!datasets.length) return nextCb(null);
    else logger.info(`writing ${ datasets.length } datasets, each to a separate file in ${ config.paths.rawData } ...`);

    [].forEach(datasets, (dataset, cb) => {
    //async.each(datasets, (dataset, cb) => {

        let serializedData = JSON.stringify(dataset, null, 4);
        let captureDate = dataset['activities-steps'][0]['dateTime'];
        let outputFilename = `${ config.paths.rawData }/${ subjectId }_${ captureDate }.json`;

        fs.writeFile(outputFilename, serializedData, (err) => { 
            cb(err); 
        });

    },
    nextCb());
}

module.exports = exports = {

    main,

    buildQueryPaths,
    extractFitBitData,
    findUncapturedDates,
    getDateBoundaries,
    handleAPIResponse,
    isErrorResponse,
    isDataResponse,
    isValidDataset,
    isClientError,
    queryAPI,
    refreshAccessToken,
    toPromiseArray,
    toStatusCodeString,
    updateTokens,
    writeDatasetsToFiles
    
};

main('001', { window: 3, })
