const cli = require('commander')
const path = require('path')
const { io } = require('../lib/utils')
const { delayedRequire } = io
const { validate, validators } = require('./validators')

const { signup, query, revoke, missing, report, status, apistatus, update, dump } = [

    'signup',
    'query',
    'revoke',
    'missing',
    'report',
    'status',
    'apistatus',
    'update',
    'dump'

].reduce(function(memo, cmd) {

    // problem: if you put commands in a commands/ sub-dir, it breaks the .env PATHS scheme

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
    .command('query <participant_id>')
    .description('Query the FitBit API for a given participant')
    .option('-w, --window-size <windowSize>', 'window size')
    .option('-r, --refresh', 'refresh oauth token')
    .option('-d, --date-range <start>..<stop>','specify a date or date range in the format of yyyy-mm-dd', s => s.split('..'))
    .action(query)

cli
    .command('revoke <participant_id>')
    .description('Revoke access token for a participant')
    .action(revoke)

cli
    .command('status')
    .description('Output study-level statistics')
    .action(status)

cli
    .command('missing <participant_id>')
    .description('Print Dates of Missing Data Files for Subject')
    .action(missing)

cli
    .command('apistatus')
    .description('Open a Google Chrome browser to the fitbit status page')
    .action(apistatus)

cli
    .command('dump')
    .description('Show all data from the database')
    .action(dump)

cli
    .command('update')
    .description('Update fbtrack')
    .action(update)

cli
    .command('report')
    .option('-a, --all', 'report on all active participants')
    .option('-p, --participant-ids <participantIds>', 'a comma-delimited list of participant ids', s => s.split(',')) 
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
