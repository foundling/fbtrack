const fs = require('fs')
const { execSync } = require('child_process')
const { isValidParticipantFilename } = require('../lib/utils/utils')
const path = require('path')
const tape = require('tape')
const { default: tapePromise } = require('tape-promise')

const Study = require('./Study')
const testDataDir = path.join(__dirname, 'test-data')
const testParticipantIds = ['test1','test2']
const testFileParts = [
  '2020-01-01_sleep.json',
  '2020-01-01_activities-heartrate.json',

  '2020-01-02_sleep.json',
  '2020-01-02_activities-heartrate.json',

  '2020-01-03_sleep.json',
  '2020-01-03_activities-heartrate.json',

  '2020-01-04_sleep.json',
  '2020-01-04_activities-heartrate.json',

  // should be filtered out
  '',
  '.json',
]

const { APP_CONFIG } = require('../config')
const { DB_PATH, DB_NAME } = APP_CONFIG
const Database = require(DB_PATH)
const testDatabaseName = 'study-test-database'
const database = new Database({ databaseFile: testDatabaseName })

const test = tapePromise(tape)

const rmDir = (path) => {
  return execSync(`rm -rf ${path}`, { encoding: 'utf8' })
}

const seedTestDataFlat = (dirPath) => {

  try {
    fs.mkdirSync(dirPath)
  } catch(e) {
    if (e.code !== 'EEXIST') {
      throw e
    }
  }

  for (let pid of testParticipantIds) {
    for (let part of testFileParts) {
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

  for (let pid of testParticipantIds) {

    const participantDir = path.join(dirPath, pid)
    fs.mkdirSync(participantDir)

    for (let part of testFileParts) {
      const fitbitFile = `${pid}_${part}`
      if (isValidParticipantFilename(fitbitFile)) {
        fs.writeFileSync(path.join(participantDir, fitbitFile))
      }
    }

  }

}

test('setup :: init db, create test fitbit json filenames on disk' , async (t) => {

  await database.init()

  rmDir(testDataDir)

  testParticipantIds.forEach(async(participantId) => {
    await database.addParticipant({
      participantId,
      registrationDate: '2020-01-01',
      accessToken: `${participantId}_ACCESS_TOKEN`,
      refreshToken: `${participantId}_REFRESH_TOKEN`,
    })
  })
  seedTestDataHierarchical(testDataDir)
  seedTestDataFlat(testDataDir)

})


test('Study model :: constructor', (t) => {

  t.plan(12)

  rmDir(testDataDir)
  seedTestDataHierarchical(testDataDir)

  const s = new Study({
    name: 'TEST_STUDY',
    flat: true,
    database,
    dataPath: testDataDir
  })

  t.equals(s.name, 'TEST_STUDY')
  t.equals(s.dataPath, testDataDir)
  t.equals(s.flat, true)
  t.deepEquals(s.database, database)
  t.equals(path.isAbsolute(s.dataPath), true)
  t.equals(s.participants, null)

  const s2 = new Study({
    dataPath: testDataDir
  })

  t.equals(s2.name, '')
  t.equals(s2.dataPath, testDataDir)
  t.equals(s2.flat, false)
  t.equals(s2.database, null)
  t.equals(s2.participants, null)


  rmDir(testDataDir)
  t.throws(() => {
    new Study({
      name: 'TEST_STUDY',
      database,
      dataPath: testDataDir
    })
  })

})

test('Study model :: init()', async (t) => {

  t.plan(2)

  rmDir(testDataDir)
  seedTestDataFlat(testDataDir)

  const s = new Study({
    name: 'TEST_STUDY',
    database,
    dataPath: testDataDir,
    flat: true,
  })

  await s.init()

  t.equal(Array.isArray(s.participants),  true)
  t.deepEqual(
    s.participants.map(p => p.participantId).sort(),
    testParticipantIds.sort()
  )

})

test('Study model :: loadFlat', async (t) => {

  rmDir(testDataDir)
  seedTestDataFlat(testDataDir)

  const s = new Study({
    name: 'TEST_STUDY',
    database,
    dataPath: testDataDir,
    flat: false,
  })

  const data = await s.loadFlat()

  testParticipantIds.forEach(testParticipantId => {
    t.deepEquals(
      [...data.get(testParticipantId)].sort(),
      testFileParts
        .map(part => `${testParticipantId}_${part}`)
        .filter(isValidParticipantFilename)
        .sort()
    )
  })

})

test('Study model :: loadHierarchical', async (t) => {

  rmDir(testDataDir)
  seedTestDataFlat(testDataDir)
  seedTestDataHierarchical(testDataDir)

  const s = new Study({
    name: 'TEST_STUDY',
    database,
    dataPath: testDataDir,
    flat: true,
  })

  const data = await s.loadHierarchical()

})

test('Study model :: clear test database, delete test fitbit json files', async (t) => {

  rmDir(testDataDir)
  database.clearParticipants()

})
