const tape = require('tape')
const tapePromise = require('tape-promise').default
const test = tapePromise(tape) 
const { format } = require('date-fns')

const Database = require('./Database')
const { dates, http, io } = require('../lib')
const { ymdFormat } = dates


let db
test('database:setup :: clearParticipants()', async (t) => {

  db = await (new Database({ databaseName: 'test-databases/test-database-db' })).init()
  await db.clearParticipants()

  t.end()

})

test('database :: addParticipant()', async (t) => {

  t.plan(2)

  const r1 = await db.addParticipant({
    participantId: 1,
    accessToken: 'participant 1 access token',
    refreshToken: 'participant 1 refresh token',
    registrationDate: format(new Date(), ymdFormat),
    isActive: true,
  })

  const r2 = await db.addParticipant({
    participantId: 2,
    accessToken: 'participant 2 access token',
    refreshToken: 'participant 2 refresh token',
    registrationDate: format(new Date(), ymdFormat),
    isActive: true,
  })

  const p1 = await db.getParticipantById(1) 
  const p2 = await db.getParticipantById(2) 
  t.equal(p1.participantId, '1')
  t.equal(p2.participantId, '2')

})


test('database :: getParticipants()', async (t) => {

  t.plan(1)

  const participants = await db.getParticipants()

  t.equal(participants.length, 2)

})


test('database :: getParticipantById()', async (t) => {

  t.plan(4)

  const participant1 = await db.getParticipantById('1')

  t.equal(participant1.participantId, '1')
  t.equal(participant1.accessToken, 'participant 1 access token')

  const participant2 = await db.getParticipantById('2')

  t.equal(participant2.participantId, '2')
  t.equal(participant2.accessToken, 'participant 2 access token')


})

test('database :: updateAccessTokensById()', async (t) => {

  t.plan(3)

  const updatedAccessToken = 'participant 1 updated access token'
  const updatedRefreshToken = 'participant 1 updated refresh token'

  await db.updateAccessTokensById({ 
    participantId: '1',
    accessToken: updatedAccessToken,
    refreshToken: updatedRefreshToken
  })

  const { participantId, accessToken, refreshToken } = await db.getParticipantById('1')

  t.equal(participantId, '1')
  t.equal(accessToken, updatedAccessToken)
  t.equal(refreshToken, updatedRefreshToken)

})

test('database :: teardown', async (t) => {
})
