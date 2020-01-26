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


const test = tapePromise(tape)

const rmDir = (path) => {
  return execSync(`rm -rf ${path}`, { encoding: 'utf8' })
}

const seedTestData = (dirPath) => {

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

test('Study model :: Setup', async (t) => {

  rmDir(testDataDir)
  seedTestData(testDataDir)

})

test('Study model :: should throw if dataPath not a directory', (t) => {

  t.plan(5)

  rmDir(testDataDir)

  // test data path doesn't exist
  t.throws(() => {
    const s = new Study({
      name: 'TEST_STUDY',
      dataPath: testDataDir
    })
  })

  t.doesNotThrow(() => {

    seedTestData(testDataDir)

    const s = new Study({
      name: 'TEST_STUDY',
      dataPath: testDataDir
    })

    t.equals(s.name, 'TEST_STUDY')
    t.equals(s.dataPath, testDataDir)
    t.equals(path.isAbsolute(s.dataPath), true)

  })

})


test('Study model :: initialize study and test indexing', async (t) => {

  t.plan(6)

  rmDir(testDataDir)
  seedTestData(testDataDir)

  const s = new Study({
    name: 'TEST_STUDY',
    dataPath: testDataDir
  })

  await s.init({ dataPath: testDataDir })

  t.equal(s.data instanceof Map, true) 
  const participantIds = [...s.data.keys()].sort()

  // has the right keys
  t.deepEquals(participantIds, ['test1','test2'])

  // values have the right type
  t.equals(s.data.get('test1') instanceof Array, true)
  t.equals(s.data.get('test2') instanceof Array, true)

  // values contain the right data
  t.deepEquals(
    s.data.get('test1').sort(),
    testFileParts.map(part => `test1_${part}`).sort()
  )
  t.deepEquals(
    s.data.get('test2').sort(),
    testFileParts.map(part => `test2_${part}`).sort()
  )

})

test('Study model :: Teardown', async (t) => {

  rmDir(testDataDir)

})
