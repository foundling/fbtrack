'use strict';

const fs = require('fs');
const moment = require('moment');

const config = require(__dirname + '/../../config');
const { 

    appendToFile,
    compact,
    dateAscending,
    dateComparator,
    dateNotIn,
    dateRE, 
    errorCallback, 
    flattenOnce,
    generateDateRange,
    inDateRange,
    isClientError,
    isValidDataSet,
    logToUserFail,
    logToUserInfo,
    matchesSubjectId,
    toDateString,
    toStatusCodeString,
    toHeartRateMetric,
    toFitBitData,
    toLength,
    ymdFormat,

} = require(config.paths.utils);

function determineStartDate(signupDateString, startDateString) {
    const signup = moment(signupDateString).unix(); 
    const start = moment(startDateString).unix(); 
    return moment(signupDateString).unix() > moment(startDateString).unix() ? signupDateString : startDateString;
}

function getSubjectDataFilenames(subjectId, signupDateString, directoryPath, callback) {

    fs.readdir(directoryPath, (err, filenames) => {
        if (err) throw err;

        const subjectFilenames = filenames.filter( matchesSubjectId(subjectId) );
        const dates = { 

            startDateString: determineStartDate(
                signupDateString, 
                moment().subtract({days: 8}).format(ymdFormat)
            ),
            stopDateString: moment().subtract({days: 1}).format(ymdFormat),

        };

        callback(
            subjectId, 
            subjectFilenames,
            dates,
            config.reminderThreshold
        );

    });
}

function needsReminder(subjectId, subjectFilenames, dates, threshold) {

    const {

        startDateString,
        stopDateString,

    } = dates;

    const idealDates = generateDateRange(startDateString, stopDateString).slice(-1 * threshold);
    const actualDates = subjectFilenames
        .map(toDateString)
        .filter(inDateRange({ start: startDateString, end: stopDateString }));

    return {
        reminder: exceedsMissedThreshold(idealDates, actualDates, threshold),
        lastSync: lastSynced(subjectFilenames)
    };
}



function lastSynced(subjectFilenames) {

    const capturedDates = subjectFilenames
        .map(toDateString)
        .sort(dateComparator(true));

    const lastCapturedDate = capturedDates.length ? capturedDates[0] : null;

    return lastCapturedDate;

}

const exceedsMissedThreshold = function(ideal, actual, window) {

    if (ideal.length < config.reminderThreshold) {
        // means signup date was less than 3 days ago
        return false;
    }

    let rv = false;
    for (var i = ideal.length - 1, consecutiveDaysMissed = 0, max = window; i > -1; --i) {

        consecutiveDaysMissed = !actual.includes(ideal[i]) ? consecutiveDaysMissed + 1 : 0;

        if ( consecutiveDaysMissed >= window ) {
            rv = true;
            break;
        } 

    }

    return rv;
};


const exceedsMissedThresholdOld = function(ideal, actual, window) {

    let rv = false;

    for (let i = 0, consecutiveDaysMissed = 0, max = ideal.length; i < ideal.length; ++i) {

        consecutiveDaysMissed = !actual.includes(ideal[i]) ? consecutiveDaysMissed + 1 : 0;

        if ( consecutiveDaysMissed >= window ) {
            rv = true;
            break;
        } 

    }

    return rv;
};

module.exports = exports = {

    exceedsMissedThreshold,
    getSubjectDataFilenames,
    lastSynced,
    needsReminder

};
