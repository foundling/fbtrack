const {
  dateREStrict,
  filenamePattern
} = require('./dates')

const parseParticipantFilename = (filename => {

  const [
    participantId,
    date,
    metric,
    extension,
  ] = filename.split(/[._]/).map(s => s.trim())

  return {
    participantId,
    date,
    metric,
    extension,
  }

})

async function sleep(s) {
  function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  await timeout(s * 1000);
}

const isValidParticipantFilename = filename => filenamePattern.test(filename);

module.exports = exports = {
  isValidParticipantFilename,
  parseParticipantFilename,
  sleep,
}
