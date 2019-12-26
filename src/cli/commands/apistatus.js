'use strict';

const exec = require('child_process').exec;

function main() {

    exec(
        `open -a '/Applications/Google Chrome.app' http://status.fitbit.com`,
        function(err, stdin, stdout) {
            if (err) throw err;
        }
    );

}

module.exports = exports = {
    main
};
