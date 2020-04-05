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

function requireParam(p) {
  throw new MissingParameterError(p)
}

class MissingParameterError extends Error {
  constructor(message) {

    super(message)

    this.name = this.constructor.name

    Error.captureStackTrace(this, this.constructor)

  }
}
module.exports = exports = {
  isValidParticipantFilename,
  MissingParameterError,
  parseParticipantFilename,
  requireParam,
  sleep,
}
