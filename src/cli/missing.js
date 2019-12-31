require('dotenv').config()

const { 
  DB_PATH,
  DB_FILENAME,
  DATA_PATH 
} = process.env 

const colors = require('colors');
const fs = require('fs');
const moment = require('moment');


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

} = require('./utils');

const Database = require(DB_PATH);
const db = new Database({ databaseFile: DB_FILENAME });

function printMissingDataFiles(subjectId) {
  return
    db.fetchOneSubject(subjectId, (err, subject) => {
        fs.readdir(DATA_PATH, (err, filenames) => {

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
