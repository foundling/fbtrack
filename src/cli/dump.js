require('dotenv').config()

const {
  DB_PATH,
  DB_FILENAME
} = process.env

const colors = require('colors');
const Database = require(DB_PATH);
const db = new Database({ databaseFile: DB_FILENAME });

function buildRowsOutput(rows) {

    let header = `
FBTRACK DATABASE DUMP:`;

    let rowsOutput = rows.map(row => {

        return `

********************************************

subject id:     ${ row.participantId }
signup date:    ${ row.registrationDate }
access token:   ${ row.accessToken }
refresh token:  ${ row.refreshToken }
deauthorized:   ${ !row.isActive ? 'yes' : 'no' }

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

module.exports = exports = { main };
