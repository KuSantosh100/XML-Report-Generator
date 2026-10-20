const {
    join,
    resolve
} = require('path');
const http = require('http');
const {
    promisify
} = require('util');
const {
    stat,
    readdir
} = require('fs');

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
//const bodyParser = require('body-parser');
const session = require('express-session');
//const flash = require('connect-flash');

require('app-module-path').addPath(__dirname + '/app/modules');
_ = require("underscore");
require('dotenv').config();


// custom modules will goes here
//include config.js, auth.js, util.js
config = require(resolve(join(__dirname, 'app', 'config')));
auth = require(resolve(join(__dirname, 'app', 'auth')))();
utils = require(resolve(join(__dirname, 'app', 'utils')));

const app = express();



const isProd = config.isProd;
const getPort = config.getPort;
const getApiFolderName = config.getApiFolderName;

global.BASE_URL = `http://${process.env.HOST}:${getPort}`;


async function isDirectory(f) {
    return (await promisify(stat)(f)).isDirectory();
}
async function _readdir(filePath) {
    const files = await Promise.all((await promisify(readdir)(filePath)).map(async f => {
        const fullPath = join(filePath, f);
        return (await isDirectory(fullPath)) ? _readdir(fullPath) : fullPath;
    }))

    return _.flatten(files);
}

app.use(cors());
const bodyParser = require('body-parser');
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.urlencoded({
    limit: "50mb",
    extended: true,
    parameterLimit: 50000
})); // get information from html forms
app.use(bodyParser.json({
    limit: "50mb"
}));

//TODO: Need to change secret and change to array if we need to maintain session of previous.
app.use(session({
    secret: 'delivery@&beverage@#',
    resave: false,
    saveUninitialized: true
}));

//console.log("    //app.use(auth.initialize())  ")
app.use(auth.initialize());
app.use(auth.session());

app.use(express.urlencoded({ extended: false })); // Replaces Body Parser
app.use(express.json()); // Replaces Body Parser


//TODO: Do we need this?
app.use(express.static('./public'));

app.use((req, res, next) => {
    // backbutton prevent
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    // Inclide main view path
    //res.locals.messages = req.flash();
    //auth = require(resolve(join(__dirname, 'app', "auth")))(req, res, next);

    res.header('Access-Control-Allow-Origin', req.header('origin'));
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');


    if (req.method == 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
       // return res.status(200).json({});
    }

    // This is for admin end
    if (req.session.token && req.session.token != null) {
        req.headers['token'] = req.session.token;
    }
    // This is for webservice end
    if (req.headers['x-access-token'] != null) {
        req.headers['token'] = req.headers['x-access-token'];
    }

        // This is for API Key end
    if (req.headers['x-api-key'] != null) {
        req.headers['apiKey'] = req.headers['x-api-key'];
    }

    

    next();

});

/**
 * Event listener for HTTP server "error" event.
 */
 const onError = (error) => {
    const port = getPort;
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string' ?
        'Pipe ' + port :
        'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(0);
            break;
        default:
            throw error;
    }
}


(async () => {
    try {
        await require(resolve(join(__dirname, 'app', 'database')))();

        /******************* Routes (Api + Admin) ************/
        const apiFiles = await _readdir(`./app/routes/${getApiFolderName}`);
        apiFiles.forEach(file => {
            if (!file && file[0] == '.') return;
            //console.log(file +": "+ require(join(__dirname, file)))
            app.use(`/${getApiFolderName}/`, require(join(__dirname, file)));
        });

        /******************* Service Launch *****************/
        
        const server = http.createServer(app);
        server.listen(getPort);
        server.on('error', onError);
        console.log(`V-Assure console backend is running on ${(global.BASE_URL && global.BASE_URL !== '') ? global.BASE_URL : `http://${process.env.HOST}:${getPort}`}`);
    } catch (error) {
        console.error("ERRROR :"+error);
    }
})();

module.exports = app;