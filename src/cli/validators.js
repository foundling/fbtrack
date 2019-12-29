// should return args as array if valid
const validators = {

  query: function (participantId, { dates=[], windowSize = null, refresh=false }) {

     // both window size and range, invalid
    if (dates.length > 0 && windowSize !== null) {
      return { error: 'Provide a window size or a date range, but not both.' }
    }

    // check dates for validity
    if (!dates.every(date => dateRE.test(date))) {
      return { error: `invalid date format: ${dates.join('..')}` }
    }

    // if both values are missing, set default window size
    if (!dates.length && windowSize == null) {
      return { warning: 'no date range provided, no window size provided. using default window size of 3 days' }
    }

    return [ participantId, { dates, windowSize, refresh } ]

  },
  signup: () => {},
  query: () => {},
  revoke: () => {},
  missing: () => {},
  status: () => {},
  apistatus: () => {},
  update: () => {},
  dump: () => {},
  undefined: () => { throw new Error('no handler defined') }
}

module.exports = {
  validate: (fn, validator) => (...args) => fn(validator(...args)),
  validators, 
}
