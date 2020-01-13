const util = require('util')
const path = require('path')
const {
  readdir,
  readFile,
  writeFile
} = require('fs')

const readdirPromise = util.promisify(readdir)
const readFilePromise = util.promisify(readFile)
const writeFilePromise = util.promisify(writeFile)

const delayedRequire = function(path) { 
  return function(...args) {
    return require(path).main(...args) 
  }
}

async function getFiles({ criterion=()=>true, directory }) {

  try {

    const filenames = await readdirPromise(directory)
    return filenames.filter(criterion)

  } catch (e) {

    throw new Error(['getFiles failed: ', e])

  }

}

async function writeDatasetsToFiles({ participantId, datasets, outputDir, log=false }) {

  console.log(`\nData collected for participant ${participantId}\n`)

  for (const date in datasets) {

    const dataset = datasets[date]

    for (const metric in dataset) {


      const filepath = path.join(outputDir,`${participantId}_${date}_${metric}.json`)
      const serialized = JSON.stringify(dataset[metric], null, 2)
      try {

        await writeFilePromise(filepath, serialized)
        if (log) {
          console.log('wrote: ', filepath) 
        }
      } catch (e) {
        logger.error(e)
      }

    }

  }
}

module.exports = exports = {
  delayedRequire,
  getFiles,
  readdirPromise,
  readFilePromise,
  writeDatasetsToFiles,
  writeFilePromise,
}
