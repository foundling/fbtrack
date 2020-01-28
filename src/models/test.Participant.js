const tape = require('tape')
const { default: tapePromise } = require('tape-promise')
test = tapePromise(tape)

const Participant = require('./Participant')

test('Participant model constructor', async (t) => {

  t.plan(2)

  const participantId = 'test-participant-1'
  const files = [
    'test-participant-1_2020-01-01_activites-heart.json',
    'test-participant-1_2020-01-01_sleep.json',
  ]

  const p = new Participant({ participantId, files  })

  t.equals(p.participantId, 'test-participant-1')
  t.deepEquals(p.files, [
    'test-participant-1_2020-01-01_activites-heart.json',
    'test-participant-1_2020-01-01_sleep.json',
  ])

})
