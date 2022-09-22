const cli = require('commander')
const path = require('path')
const { delayedRequire } = require('../lib/io')
const { splitArgsOn } = require('../lib/formatters')

const { validate, validators } = require('./validators')

const { configure, register, query, apistatus, report } = [

  'configure',
  'register',
  'query',
  'apistatus'

].reduce(function(memo, cmd) {

  const lazyFn = delayedRequire(path.join(__dirname, cmd))
  const commandValidator = validators[cmd]
  const validatedLazyFn = validate(commandValidator, lazyFn)
  memo[cmd] = validatedLazyFn

  return memo

}, {})

cli.version('0.0.1', '-v, --version', 'output the current version information')
cli
  .command('register')
  .description('Initiate participant authorization process in Google Chrome.')
  .action(register)

cli
  .command('configure')
  .description('Configure the app parameters necessary for registering participants and collecting data')
  .action(configure)

cli
  .command('query')
  .description('Query the FitBit API for participant(s)')
  .option('-a, --all', 'query fitbit for all participants, no participant id is required')
  .option('-p, --participant-ids <participantIds>', 'a comma-delimited list of participants', splitArgsOn(','))
  .option('-w, --window-size <windowSize>', 'window size')
  .option('-r, --refresh', 'refresh oauth token')
  .option('-d, --date-range <dates...>', 'specify a date or date range in the format of yyyy-mm-dd')
  .option('-n, --chunk-size <chunkSize>', 'Number of participants to query simultaneously')
  .action(query)

  /*
cli
  .command('revoke <participant_id>')
  .description('Revoke access token for a participant')
  .action(revoke)
  */

cli
  .command('apistatus')
  .description('Open a Google Chrome browser to the fitbit status page')
  .action(apistatus)

/*
cli
  .command('report')
  .option('-a, --all', 'report on all active participants')
  .option('-p, --participant-ids <participantIds>', 'a comma-delimited list of participant ids', splitArgsOn(','))
  .option('-m, --missing-only', 'Filter report to show missing data')
  .description('Report missing files for participant(s)')
  .action(report)
  */

  /*
cli
  .command('schedule')
  .option('-w, --weekday <...weekday>', 'recurring day and time of week', (value, previous) => previous.concat([value]), [])
  .description('Run fbtrack on a given time /day of week. Pass flag repeatedly for multiple days')
  .action(({parent}) => schedule({parent, weekday: parent.rawArgs.slice(3) }))
  */

module.exports = exports = {

  start: function() {

    if (!process.argv.slice(2).length)
      cli.outputHelp(helpText => helpText)

    else
      cli.parse(process.argv)

  }

}
