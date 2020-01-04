const tape = require('tape')
const tapePromise = require('tape-promise').default
const test = tapePromise(tape) 
const { format } = require('date-fns')

const Database = require('.')
const { ymdFormat } = require('../lib/utils')
const db = new Database({ databaseFile: 'test.sqlite' })

test('::setup', async (t) => {

  await db.init()
  await db.clearParticipants()

  t.end()
})

test('::teardown', async (t) => {
  t.end()
})

test('::database | create participant', async (t) => {

  t.plan(1);

  const r1 = await db.addParticipant({
    participantId: 1,
    accessToken: 'TEST ACCESS TOKEN',
    refreshToken: 'TEST REFRESH TOKEN',
    registrationDate: format(new Date(), ymdFormat),
    isActive: true,
  })
  const r2 = await db.addParticipant({
    participantId: 2,
    accessToken: 'TEST ACCESS TOKEN',
    refreshToken: 'TEST REFRESH TOKEN',
    registrationDate: format(new Date(), ymdFormat),
    isActive: true,
  })

  t.equal(r2.lastID, 2)

})
