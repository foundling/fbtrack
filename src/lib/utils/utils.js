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

const isValidParticipantFilename = filename => filenamePattern.test(filename);

module.exports = exports = {
  isValidParticipantFilename,
  parseParticipantFilename,
}
