'use strict';

const colors = require('colors'); 
const FitBitClient = require('fitbit-node');
const config = require('../../config');
const client = new FitBitClient(config.clientId, config.clientSecret);
const { 
    logToUserInfo,
    logToUserSuccess, 
    logToUserFail 
} = require(config.paths.utils);
const Database = require(config.paths.db);
const db = new Database(config.paths.store);

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
