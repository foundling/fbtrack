const fs = require('fs');
const moment = require('moment');
const path = require('path');

const db = require('./../../db')
const { 

    debug, 
    dateRE, 
    errorCallback, 
    logToUserSuccess, 
    logToUserFail, 
    logToFile, 
    ymdFormat

} = require('../utils');

const timeStamp = moment().format('YYYY-MM-DD hh:mm A');
 
function logErrors(subjectId, clientErrorCodes) {


    return
    let errorLogFilename = `${ moment().format(ymdFormat) }_errors.txt`;
    let errorLogFilepath = path.join(config.paths.errorLogs, errorLogFilename);
    let logContent = [
        `DATE: ${ timeStamp }`,
        `SUBJECT ID: ${ subjectId }`,
        `ERROR CODES: ${ clientErrorCodes.join(', ') }`,
        '\n'
    ].join('\n');

    fs.appendFile(errorLogFilepath, logContent, (err) => {
        if (err) throw err;
        logToUserFail(`Wrote ${ clientErrorCodes.length } errors to ${ errorLogFilepath }.`);
    });

}

function getMetricType(path) {

    /* Determine the metric type that an API endpoing is meant to query */

    return [ 

        'steps', 
        'calories', 
        'distance', 
        'heart', 
        'sleep' 

    ]
    .filter(metric => path.indexOf(metric) > -1)[0];

}

module.exports = exports = { 
    getMetricType,
    logErrors
};
