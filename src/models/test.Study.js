const fs = require('fs')
const { execSync } = require('child_process')
const path = require('path')
const tape = require('tape')
const { default: tapePromise } = require('tape-promise')

const Study = require('./Study') 
const testDataDir = path.join(__dirname, 'test-data')
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
  const participantIds = ['test1', 'test2']

  for (let pid of participantIds) {
    for (let part of testFileParts) {
      const fitbitFile = `${pid}_${part}`
      fs.writeFileSync(path.join(dirPath, fitbitFile))
    }
  }

}

const seedTestDataHierarchical = (dirPath) => {

  fs.mkdirSync(dirPath) 
  const participantIds = ['test1', 'test2']

  for (let pid of participantIds) {

    const participantDir = path.join(dirPath, pid) 
    fs.mkdirSync(participantDir) 

    for (let part of testFileParts) {
      const fitbitFile = `${pid}_${part}`
      fs.writeFileSync(path.join(participantDir, fitbitFile))
    }

  }

}

test('setup :: init db' , async (t) => {
  await database.init()
})

test('Study model :: create test data', async (t) => {
  rmDir(testDataDir)
  seedTestDataHierarchical(testDataDir)
})

test('Study model :: should throw if dataPath not a directory', async (t) => {

  t.plan(1)

  rmDir(testDataDir)

  // test data path doesn't exist
  t.throws(() => {
    const s = new Study({
      name: 'TEST_STUDY',
      database,
      dataPath: testDataDir
    })
  })

})

test('Study model :: initialized values', (t) => {

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

test('Study model :: init method', async (t) => {

  t.plan(1)

  rmDir(testDataDir)
  seedTestDataHierarchical(testDataDir)

  const s = new Study({
    name: 'TEST_STUDY',
    database,
    dataPath: testDataDir,
    flat: true,
  })

  await s.init()

  t.equal(Array.isArray(s.participants),  true)

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

  t.deepEquals(
    [...data.get('test1')].sort(),
    testFileParts.map(part => `test1_${part}`).sort()
  )

  t.deepEquals(
    [...data.get('test2')].sort(),
    testFileParts.map(part => `test2_${part}`).sort()
  )
 
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

})
