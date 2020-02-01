const fs = require('fs')
const { execSync } = require('child_process')
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

  fs.mkdirSync(dirPath) 

  for (let pid of testParticipantIds) {
    for (let part of testFileParts) {
      const fitbitFile = `${pid}_${part}`
      fs.writeFileSync(path.join(dirPath, fitbitFile))
    }
  }

}

const seedTestDataHierarchical = (dirPath) => {

  fs.mkdirSync(dirPath) 

  for (let pid of testParticipantIds) {

    const participantDir = path.join(dirPath, pid) 
    fs.mkdirSync(participantDir) 

    for (let part of testFileParts) {
      const fitbitFile = `${pid}_${part}`
      fs.writeFileSync(path.join(participantDir, fitbitFile))
    }

  }

}

test('setup :: init db, create test fitbit json filenames on disk' , async (t) => {

  await database.init()

  testParticipantIds.forEach(participantId => {
    database.addParticipant({
      participantId,
      registrationDate: '2020-01-01',
      accessToken: `${participantId}_ACCESS_TOKEN`,
      refreshToken: `${participantId}_REFRESH_TOKEN`,
    })
  })

  rmDir(testDataDir)
  seedTestDataHierarchical(testDataDir)

})

test('Study model :: should throw if dataPath doesnt exist', async (t) => {

  t.plan(1)

  rmDir(testDataDir)

  t.throws(() => {
    const s = new Study({
      name: 'TEST_STUDY',
      database,
      dataPath: testDataDir
    })
  })

})

test('Study model :: constructor', (t) => {

  t.plan(4)

  rmDir(testDataDir)
  seedTestDataHierarchical(testDataDir)

  const s = new Study({
    name: 'TEST_STUDY',
    database,
    dataPath: testDataDir
  })

  t.equals(s.name, 'TEST_STUDY')
  t.equals(s.dataPath, testDataDir)
  t.deepEquals(s.database, database)
  t.equals(path.isAbsolute(s.dataPath), true)


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
  t.deepEqual(s.participants.map(p => p.participantId).sort(), testParticipantIds.sort())

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
      testFileParts.map(part => `${testParticipantId}_${part}`).sort()
    )
  })
 
})

test('Study model :: loadHierarchical', async (t) => {

  const s = new Study({
    name: 'TEST_STUDY',
    database,
    dataPath: testDataDir,
    flat: true,
  })

  const data = await s.loadHierarchical()

})

test('Study model :: delete test data', async (t) => {

  rmDir(testDataDir)
  database.clearParticipants()

})
