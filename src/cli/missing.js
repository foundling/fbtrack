' use strict';

/* 
 *  db call: active subject ids and registration dates
 *  file read: last fbtrack run 
 *  file reads: subject id missing data files 
 *  file read: current outstanding syncs
 *
 */

const async = require('async');
const colors = require('colors');
const fs = require('fs');
const moment = require('moment');

const config = require(__dirname + '/../../config');
const Database = require(config.paths.db);
const db = new Database(config.paths.store);
const rawDataDir = config.paths.rawData;
const { 

    dateRE, 
    dateNotIn,
    dateComparator,
    generateDateRange, 
    logToUserSuccess, 
    logToUserInfo, 
    toDateString,
    isRawDataFile,
    includesDate

} = require(config.paths.utils);


function printMissingDataFiles(subjectId) {
    db.fetchOneSubject(subjectId, (err, subject) => {
        fs.readdir(config.paths.rawData, (err, filenames) => {

            const subjectFiles = filenames
                .filter(filename => filename.match(/_[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].json/))
                .filter(filename => filename.startsWith(subject.subjectId)); 

            const signupDate = moment(subject.signupDate);
            const today = moment();
            const daysAgo = today.diff(signupDate, 'days');
            const startDateString = today.clone().subtract({ days: daysAgo });
            const stopDateString = today.clone().subtract({ days: 1 });

            const idealDates = generateDateRange(startDateString, stopDateString);
            const capturedDates = subjectFiles.map(toDateString);
            const missingDates = idealDates.filter(dateNotIn(capturedDates));

            console.log(colors.blue(`MISSING DATA BY DATE FOR SUBJECT ID: ${ subjectId }`));
            console.log(missingDates.join('\n'));


        });
    });
}

module.exports = exports = {

    main: function(subjectId) {
        if (!subjectId) {
            logToUserFail('subjectId argument is required');
            process.exit(1);
        }
        printMissingDataFiles(subjectId);        
    }

};
