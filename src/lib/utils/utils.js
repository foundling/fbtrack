const { dateREStrict } = require('./dates')
const { FITBIT_CONFIG } = require('../../config')

const parseParticipantFilename = (filename => {

  const [
    participantId,
    date,
    metric,
    extension,
  ] = filename.split(/[._]/)

  return {
    participantId,
    date,
    metric,
    extension,
  }

})

const isValidParticipantFilename = filename => {

  const { participantId, date, metric, extension } = parseParticipantFilename(filename)
  return participantId.trim().length > 0 &&
         dateREStrict.test(date.trim()) &&
         Object.keys(FITBIT_CONFIG.ENDPOINTS).includes(metric.trim()) &&
         extension.trim() === 'json'

}

module.exports = exports = {
  isValidParticipantFilename,
  parseParticipantFilename,
}
