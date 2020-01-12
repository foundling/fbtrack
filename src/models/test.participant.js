const tape = require('tape')
const { default: tapePromise } = require('tape-promise')
test = tapePromise(tape)

const { APP_CONFIG } = require('../config')
const { DB_NAME, DB_PATH } = APP_CONFIG
const Participant = require('./Participant')

const Database = require(DB_PATH)

let db

test('setup - create participant test database', async (t) => {
  db = new Database({ databaseFile: 'test-db-participant' })
  await db.init()
})

test('Participant model constructor', async (t) => {

  t.plan(2)

  const p = new Participant({ participantId: 'test-participant1', store: db })

  t.equals(p.participantId, 'test-participant1')
  t.deepEquals(p.store, db)


})

test('Participant fetch', async (t) => {

  t.plan(2)

  const p = new Participant({ participantId: 'test-participant2', store: db })
  const data = await p.fetch()

  t.equals(data, undefined)
  t.equals(p.data, undefined)




})

test('teardown', async (t) => {
  // delete the db
})
