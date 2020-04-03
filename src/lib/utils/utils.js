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

  if (isNaN(Number(s))) {
    throw new Error(`sleep takes a single numeric paramater, but ${s} is not a number.`)
  }

  const ms = s * 1000
  const stopTime = (new Date()).getTime() + ms

  return new Promise(resolve => {
    setInterval(() => {

      if ((new Date()).getTime() > stopTime) {
        return resolve()
      }

    }, 5000)
  })

}

const isValidParticipantFilename = filename => filenamePattern.test(filename);

module.exports = exports = {
  isValidParticipantFilename,
  parseParticipantFilename,
  sleep,
}
