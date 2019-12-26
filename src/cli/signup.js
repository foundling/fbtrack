'use strict';

const exec = require('child_process').exec;

const config = require(__dirname + '/../../config');
const server = require(config.paths.server);

function main() {
    //server.start(openAppInChrome);
    server.start(() => {});
}

function openAppInChrome(port) {

    exec(
        `open -a '/Applications/Google Chrome.app' ${`http://localhost:${port}/start`}`, 
        { 'cwd': config.paths.server }, 
        function(err) { 
            if (err) throw err; 
        }  
    );

}

module.exports = exports = {

    main,

    openAppInChrome
};
