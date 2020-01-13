const cli = require('commander')
const path = require('path')
const { io } = require('../lib/utils')
const { delayedRequire } = io
const { validate, validators } = require('./validators')

const { signup, query, report, revoke, apistatus } = [

  'signup',
  'query',
  'report',
  'revoke',
  'apistatus',

].reduce(function(memo, cmd) {

  const lazyFn = delayedRequire(path.join(__dirname, cmd))
  const commandValidator = validators[cmd]
  const validatedLazyFn = validate(commandValidator, lazyFn)
  memo[cmd] = validatedLazyFn

  return memo

}, {})

cli
  .command('signup')
  .description('Initiate participant authorization process in Google Chrome.')
  .action(signup)

cli
  .command('query')
  .description('Query the FitBit API for participant(s)')
  .option('-a, --all', 'query fitbit for all participants, no participant id is required')
  .option('-p, --participant-ids <participantIds>', 'a comma-delimited list of participants', s => s.split(',').filter(Boolean))
  .option('-w, --window-size <windowSize>', 'window size')
  .option('-r, --refresh', 'refresh oauth token')
  .option('-d, --date-range <start>..<stop>','specify a date or date range in the format of yyyy-mm-dd', s => s.split('..').filter(Boolean))
  .action(query)

cli
  .command('revoke <participant_id>')
  .description('Revoke access token for a participant')
  .action(revoke)

cli
  .command('apistatus')
  .description('Open a Google Chrome browser to the fitbit status page')
  .action(apistatus)

cli
  .command('report')
  .option('-a, --all', 'report on all active participants')
  .option('-p, --participant-ids <participantIds>', 'a comma-delimited list of participant ids', s => s.split(',').filter(Boolean)) 
  .description('Report missing files for participant(s)')
  .action(report)

module.exports = exports = {

  start: function() {

    if (!process.argv.slice(2).length)
      cli.outputHelp(helpText => helpText)

    else
      cli.parse(process.argv)

  }

}
