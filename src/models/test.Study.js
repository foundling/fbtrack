const fs = require('fs')
const { execSync } = require('child_process')
const { isValidParticipantFilename } = require('../lib/utils/utils')
const path = require('path')
const tape = require('tape')
const { default: tapePromise } = require('tape-promise')

const Study = require('./Study')
const TEST_DATA_DIR = path.join(__dirname, 'test-data')
const TEST_PARTICIPANT_IDS = ['test1','test2']
const TEST_FILE_PARTS = [
  '2020-01-01_sleep.json',
  '2020-01-01_activities-heartrate.json',

  '2020-01-02_sleep.json',
  '2020-01-02_activities-heartrate.json',

  '2020-01-03_sleep.json',
  '2020-01-03_activities-heartrate.json',

  '2020-01-04_sleep.json',
  '2020-01-04_activities-heartrate.json',

  '',
  '.json',
]

const { APP_CONFIG } = require('../config').getConfig()
const { DB_PATH, DB_NAME } = APP_CONFIG
const Database = require(DB_PATH)
const testDatabaseName = 'study-test-database'
const database = new Database({ databaseFile: testDatabaseName })

const test = tapePromise(tape)

const rmDir = (path) => execSync(`rm -rf ${path}`, { encoding: 'utf8' })

const seedTestDataFlat = (dirPath) => {

  try {

    fs.mkdirSync(dirPath)

  } catch(e) {

    if (e.code !== 'EEXIST') {
      throw e
    }

  }

  for (let pid of TEST_PARTICIPANT_IDS) {

    for (let part of TEST_FILE_PARTS) {
      const fitbitFile = `${pid}_${part}`
      // dont filter files here for valid ones, need to test that
      fs.writeFileSync(path.join(dirPath, fitbitFile))
    }

  }

}

const seedTestDataHierarchical = (dirPath) => {

  try {
    fs.mkdirSync(dirPath)
  } catch(e) {
    if (e.code !== 'EEXIST') {
      throw e
    }
  }

  for (let pid of TEST_PARTICIPANT_IDS) {

    const participantDir = path.join(dirPath, pid)
    fs.mkdirSync(participantDir)

    for (let part of TEST_FILE_PARTS) {
      const fitbitFile = `${pid}_${part}`
      if (isValidParticipantFilename(fitbitFile)) {
        fs.writeFileSync(path.join(participantDir, fitbitFile))
      }
    }

  }

}

test('study model :: setup :: init db, create test fitbit json filenames on disk' , async (t) => {

  await database.init()

  rmDir(TEST_DATA_DIR)

  TEST_PARTICIPANT_IDS.forEach(async(participantId) => {
    await database.addParticipant({
      participantId,
      registrationDate: '2020-01-01',
      accessToken: `${participantId}_ACCESS_TOKEN`,
      refreshToken: `${participantId}_REFRESH_TOKEN`,
    })
  })
  seedTestDataHierarchical(TEST_DATA_DIR)
  seedTestDataFlat(TEST_DATA_DIR)

})


test('study model :: constructor() ', (t) => {

  t.plan(12)

  rmDir(TEST_DATA_DIR)
  seedTestDataHierarchical(TEST_DATA_DIR)

  const s = new Study({
    name: 'TEST_STUDY',
    flat: true,
    database,
    dataPath: TEST_DATA_DIR
  })

  t.equals(s.name, 'TEST_STUDY')
  t.equals(s.dataPath, TEST_DATA_DIR)
  t.equals(s.flat, true)
  t.deepEquals(s.database, database)
  t.equals(path.isAbsolute(s.dataPath), true)
  t.deepEquals(s.participants, new Map())

  const s2 = new Study({
    dataPath: TEST_DATA_DIR
  })

  t.equals(s2.name, '')
  t.equals(s2.dataPath, TEST_DATA_DIR)
  t.equals(s2.flat, false)
  t.equals(s2.database, null)
  t.deepEquals(s2.participants, new Map())


  rmDir(TEST_DATA_DIR)
  t.throws(() => {
    new Study({
      name: 'TEST_STUDY',
      database,
      dataPath: TEST_DATA_DIR
    })
  })

})

test('Study model :: init() with a single data directory for all participants', async (t) => {

  t.plan(2)

  rmDir(TEST_DATA_DIR)
  seedTestDataFlat(TEST_DATA_DIR)

  const s = new Study({
    name: 'TEST_STUDY',
    database,
    dataPath: TEST_DATA_DIR,
    flat: true,
  })

  await s.init()

  t.equal([...s.participants.keys()].length > 0, true)
  t.deepEqual(
    [...s.participants.keys()].sort(),
    TEST_PARTICIPANT_IDS.slice().sort()
  )

})


test('Study model :: init() with a data directory with subdirs for each participant', async (t) => {

  t.plan(2)

  rmDir(TEST_DATA_DIR)
  seedTestDataHierarchical(TEST_DATA_DIR)

  const s = new Study({
    name: 'TEST_STUDY',
    database,
    dataPath: TEST_DATA_DIR,
    flat: false,
  })

  await s.init()

  t.equal([...s.participants.keys()].length > 0, true)
  t.deepEqual(
    [...s.participants.keys()].sort(),
    TEST_PARTICIPANT_IDS.slice().sort()
  )

})

test('study model :: teardown :: clear test database, delete test fitbit json files', async (t) => {

  rmDir(TEST_DATA_DIR)
  database.clearParticipants()

})
