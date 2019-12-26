function main() {

    require('child_process').exec(
        `open -a '/Applications/Google Chrome.app' http://status.fitbit.com`,
        function(err, stdin, stdout) { if (err) throw err }
    );

}

module.exports = exports = { main };
