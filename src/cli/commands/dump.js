'use strict';

const config = require(__dirname + '/../../config');
const colors = require('colors');
const Database = require(config.paths.db);
const db = new Database(config.paths.store);

function buildRowsOutput(rows) {

    let header = `
FBTRACK DATABASE DUMP:`;

    let rowsOutput = rows.map(row => {

        return `

********************************************

subject id:     ${ row.subjectId }
signup date:    ${ row.signupDate }
access token:   ${ row.accessToken }
refresh token:  ${ row.refreshToken }
deauthorized:   ${ !row.active ? 'yes' : 'no' }

********************************************

`;


    });

    showRows(header + rowsOutput);

}

function showRows(rowsOutput) {
    console.log(colors.blue(rowsOutput));
}

function main() {
    db.fetchAllSubjects((err, subjects) => {
        if (err) throw err;
        buildRowsOutput(subjects);
    });
}

module.exports = exports = {
    main 
};
