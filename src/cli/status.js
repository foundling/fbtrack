require('dotenv').config()

const async = require('async');
const colors = require('colors');
const fs = require('fs');
const moment = require('moment');

const {
  DB_PATH,
  DB_FILENAME,
  DATA_PATH
} = process.env

const Database = require(DB_PATH);
const db = new Database({ databaseFile: DB_FILENAME });
const rawDataDir = DATA_PATH
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

function moreInformation(cb) {
    logToUserInfo(`To get missing data files for a subject, run 'fbtrack missing <subject_id>'`); 
    cb()
}
function printSubjectsAndSignupDates(cb) {

    /* get subject ids and registration dates */
    db.fetchActiveSubjects((err, subjects) => {
        if (err) throw err;
        
        const sortedSubjects = subjects.sort((s1, s2) => moment(s1.signupDate).unix() - moment(s2.signupDate).unix()); 
        console.log(colors.blue('Active Subjects by Signup Date'));
        sortedSubjects.forEach(({subjectId, signupDate}) => {
            console.log('subject id: ', subjectId, '\t', 'signup date: ', signupDate);
        });
        cb();

    });

}

function printLastFbtrackRun(cb) {
    fs.readdir(`${LOGS_DIR}/reminders`, (err, files) => {
        if (err) throw err;

        const dates = files
            .filter(filename => filename.match(/^SEA_reminders_[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].txt$/))
            .map(file => file.slice(-14).slice(0,10))
            .sort(dateComparator(true));

        const msg = dates.length ? dates[0]: 'information is missing';
        console.log(colors.blue('Last Fbtrack Run: '), msg);

        cb();
    });
}

function printActiveAndInactiveSubjects(cb) {
    db.fetchActiveSubjects((err, subjects) => {
        if (err) throw err;

        const activeSubjects = subjects
            .filter(subject => subject.active)
            .map(subject => subject.subjectId);

        const inactiveSubjects = subjects
            .filter(subject => !subject.active)
            .map(subject => subject.subjectId);


        console.log(colors.blue('Active Subjects'));
        console.log(activeSubjects.join('\n'));

        console.log('');
        console.log(colors.blue('Inactive Subjects')); 
        console.log(inactiveSubjects.join('\n') || 'No Inactive Subjects');
        cb();
    });
}

function printCurrentOutstandingSyncs(cb) {

    fs.readdir(`${LOGS_DIR}/reminders`, (err, filenames) => {
        if (err) throw err;

        const reminderFiles = filenames
            .filter(filename => filename.match(/^SEA_reminders_[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].txt$/));

        const sortedFiles = reminderFiles.sort((f1, f2) => {

            const f1Date = f1.slice(-14).slice(0,10);
            const f2Date = f2.slice(-14).slice(0,10);

            return moment(f2Date).unix() - moment(f1Date).unix();
        });

        fs.readFile(`${LOGS_DIR}/reminders/${sortedFiles[0]}`, 'utf8', (err, fileContent) => {
            if (err) throw err;

            console.log(colors.blue('Outstanding Syncs'));
            console.log(fileContent.split('\n').filter(line => line.length).join('\n'));

            cb();
        });

    });

}

function logSpace(cb) {
    console.log('\n');
    cb();
}

module.exports = exports = {

    main: function() {
        async.series([

            logSpace,
            moreInformation,
            logSpace,
            printSubjectsAndSignupDates,
            logSpace,
            printLastFbtrackRun,
            logSpace,
            printActiveAndInactiveSubjects,
            logSpace,
            printCurrentOutstandingSyncs, 
            logSpace

        ]);
    }

};
