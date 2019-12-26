'use strict';

const async = require('async');
const colors = require('colors');
const fs = require('fs');
const moment = require('moment');
const config = require(__dirname + '/../../config');

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
    logToUserInfo, 
    logToUserSuccess, 
    logToUserFail, 
    logToFile, 
    matchesSubjectId,
    parseDateRange,
    toDateString,
    toHeartRateMetric,
    ymdFormat, 

} = require(config.paths.utils);

const isValidDataset = (day) => !!day['activities-heart-intraday'].dataset.length;
const toStatusCodeString = (day) => day[1][1].statusCode.toString();
const isErrorResponse = (day) => day.some(metric => metric[0].errors);
const isDataResponse = (day) => day.some(metric => metric[0]['activities-heart-intraday']);
const isClientError = (statusCode) => statusCode.startsWith('4');

const { 

    logErrors

} = require(config.paths.reporting + '/queryMonitor');

const FitBitClient = require('fitbit-node');
const client = new FitBitClient(config.clientId, config.clientSecret);
const Database = require(config.paths.db);
const db = new Database(config.paths.store);
const commandOptions = { windowSize: null };
const todaysDateString = moment().format(ymdFormat);


function preQueryCheck(subjectData) {

    if (!subjectData)
        return logToUserFail(`This subject id is not in the database.`);

    if (subjectData.signupDate === todaysDateString) {
        logToUserSuccess(`Subject ${subjectData.subjectId} was signed up today. No need to query.`);  
        process.exit(0);
    }

    getAllSubjectFiles(subjectData);

}

function getAllSubjectFiles(subjectData) {

    fs.readdir(config.paths.rawData, (err, filenames) => {
        if (err) throw err;

        const allDatesCaptured = filenames
            .filter(matchesSubjectId(subjectData.subjectId))
            .map(toDateString);

        let dateRange = null;

        if (commandOptions.dates)
            dateRange = commandOptions.dates.length === 1 ? [commandOptions.dates[0], commandOptions.dates[0]] : commandOptions.dates;
                          
        const { startDate, stopDate } = getDateBoundaries(
            subjectData.signupDate, 
            commandOptions.windowSize, 
            dateRange
        ); 

        const uncapturedDates = findUncapturedDates(startDate, stopDate, allDatesCaptured); 

        buildQueryPaths(uncapturedDates);

    });
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
 *
 * Query Functions / Async Control Flow 
 *
 *
 */

function main(subjectId, { windowSize, dates, forceRefresh }) {

    commandOptions.windowSize = dates ? null : windowSize;
    commandOptions.dates = dates;
    commandOptions.forceRefresh = forceRefresh;

    if (!subjectId) {
        logToUserFail('Error: no subject id provided. Exiting ...');
        process.exit(1);
    }

    /* short circuit to autorefresh */
    if (commandOptions.forceRefresh && ! refreshAccessToken.called) {
        logToUserInfo(`forcing token refresh for subject [ ${ subjectId } ]`);
        return db.fetchOneSubject(subjectId, (err, subjectData) => {
            if (err) throw err;
            if (!subjectData) return logToUserFail(`subject [ ${ subjectId } ] is not in the database.`);
            return refreshAccessToken(subjectData);
        });
    }

    logToUserInfo(`Running Fbtrack for subject ${ colors.white(subjectId) }`);

    db.fetchOneSubject(subjectId, (err, subjectData) => {
        if (err) throw err;
        preQueryCheck(subjectData);
    }); 

}

function restartQuery({ subjectId }) {

    if (!subjectId) {
        logToUserFail(subjectId);
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
            return client.get(path, db.sessionCache.get('accessToken')); 
        });
    });

    queryAPI(requestGroups);

}

function queryAPI(requestGroups) {

    logToUserInfo(`Requesting the following data from the FitBitAPI: [ ${ colors.white( config.scope.split(',').join(', ') ) } ].`); 

    Promise.all(requestGroups.map(requestGroup => Promise.all(requestGroup)))
        .then(handleAPIResponse, (e) => { return logToUserFail(e); })
        .catch(e => { logToUserFail('Something went wrong with the fitbit API query ... ', e); });

}

function handleAPIResponse(responseGroups) {

    const subjectId = db.sessionCache.get('subjectId');
    const signupDate = db.sessionCache.get('signupDate');

    const statusCodeStrings = responseGroups.map(toStatusCodeString);
    const errorResponses = responseGroups.filter(isErrorResponse);
    const dataResponses = responseGroups.filter(isDataResponse);
    const validDatasets = extractFitBitData(dataResponses).filter(isValidDataset); 

    logToUserInfo(`Status codes from request for subject ${ subjectId }: ${ colors.white(statusCodeStrings.join(',')) }.`);
    logToUserInfo(`# valid datasets: ${ colors.white(validDatasets.length) }.`);
    logToUserInfo(`# errors: ${ colors.white(errorResponses.length) }.`);

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

        logToUserInfo(`Access Token for subject ${ db.sessionCache.get('subjectId') } has expired. Refreshing tokens ... `);

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
        logToUserFail(`Unexpected multiple token refresh attempts. Exiting ...`); 
        process.exit(1);
    } 
    refreshAccessToken.called = true;

    client
        .refreshAccessToken(subjectData.accessToken, subjectData.refreshToken, 3600)
        .then(updateTokens)
        .catch(e => {
            logToUserFail(
                `Token update failed. Contact Alex.`,
                `Error details: ${ JSON.stringify(e.context.errors[0]) }`
            );
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
    else logToUserInfo(`writing ${ datasets.length } datasets, each to a separate file in ${ config.paths.rawData } ...`);

    async.each(datasets, (dataset, cb) => {

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
