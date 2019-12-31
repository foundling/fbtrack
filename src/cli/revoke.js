require('dotenv').config()

const colors = require('colors'); 
const FitBitClient = require('fitbit-node');
const {
  DB_PATH,
  CLIENT_ID,
  CLIENT_SECRET
} = process.env

const { 
    logToUserInfo,
    logToUserSuccess, 
    logToUserFail 
} = require('./utils');

const client = new FitBitClient(CLIENT_ID, CLIENT_SECRET);
const Database = require(DB_PATH);
const db = new Database({ databaseFile: DB_FILENAME });

function main(subjectId) {

    db.fetchOneSubject(subjectId, (err, subjectData) => {
        if (err) throw err;
        revokeAccess(subjectData);
    });      

}

function revokeAccess(subjectData) {

    if (!subjectData) throw new Error('No subject data returned from database call db.fetchOneSubject');

    logToUserInfo(`revoking access token for subject ${ subjectData.subjectId } ...`);

    client.revokeAccessToken(subjectData.accessToken)
        .then(onSuccess, logToUserFail)
        .catch(logToUserFail);

}

function onSuccess() {

    const subjectId = db.sessionCache.get('subjectId');
    logToUserSuccess(`subject id [ ${ subjectId } ] successfully revoked from fitBit's API.`);

    db.deauthorizeSubject(subjectId, (err) => {
        if (err) throw err;
        logToUserSuccess(`Subject id [ ${ subjectId } ] successfully deauthorized from the study!`);
    });

}

module.exports = exports = {

    main,

    onSuccess,
    revokeAccess

};
