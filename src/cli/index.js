require('dotenv').config()

const cli = require('commander');
const { delayedRequire } = require('./utils');

const lazyHandlers = [

    'signup',
    'query',
    'revoke',
    'missing',
    'status',
    'apistatus',
    'update',
    'dump'

]
.reduce((o, cmd) => {

    o[cmd] = delayedRequire(`./commands/${ cmd }`);
    return o;

}, {});

const { signup, query, revoke, missing, status, apistatus, update, dump }  = lazyHandlers; 

cli
    .command('signup')
    .description('Initiate subject authorization process in Google Chrome.')
    .action(signup);

cli
    .command('query <subject_id>')
    .description('Query the FitBit API for a given subject')
    .option('-w, --window-size <windowSize>', 'window size')
    .option('-r, --refresh','refresh oauth token')
    .option('-d, --dates <start>..<stop>','specify a date or date range in the format of yyyy-mm-dd', s => s.split('..'))
    .action(query);

cli
    .command('revoke <subject_id>')
    .description('Revoke access token for a subject')
    .action(revoke);

cli
    .command('status')
    .description('Output study-level statistics')
    .action(status);

cli
    .command('missing <subject_id>')
    .description('Print Dates of Missing Data Files for Subject')
    .action(missing);

cli
    .command('apistatus')
    .description('Open a Google Chrome browser to the fitbit status page')
    .action(apistatus);

cli
    .command('dump')
    .description('Show all data from the database')
    .action(dump);

cli
    .command('update')
    .description('Update fbtrack')
    .action(update);


module.exports = exports = {

  start: function() {

    if (!process.argv.slice(2).length)
      cli.outputHelp(helpText => helpText);

    else
      cli.parse(process.argv);

  }

};
