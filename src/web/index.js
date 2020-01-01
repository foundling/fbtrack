const express = require('express');
const bodyParser = require('body-parser');
const expressHandlebars = require('express-handlebars');
const cors = require('cors');

const app = express();
const routes = require('./routes');
const {

    logToUserInfo

} = require(config.paths.utils);

// configure middleware
app.set('view engine', expressHandlebars());
app.set('views', './views');
app.use(express.static('./public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
    origin: 'http://localhost:3000'
}));

/*
// bind routes
app.get('/', routes.index);
app.post('/authorize', routes.authorize);
app.get('/store_subject_data', routes.storeSubjectData);
app.get('/subjectExists', routes.subjectExists);
app.post('/quit', routes.stopServer);
*/

// define the start server callback
const start = function(cb) {

    app.listen(config.port, function() {

        cb(config.port);
        logToUserInfo(`Local Web Server Running on port ${ config.port }`);
        logToUserInfo(`Go To http://localhost:${ config.port } to register subject with SEA study`);

    });

};

module.exports = exports = {
    start: start
};

