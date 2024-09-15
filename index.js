require('custom-env').env('staging');

const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const cluster = require('cluster');
const morgan = require('morgan');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const moment = require('moment');
const rfs = require('rotating-file-stream') // version 2.x
const timeout = require('connect-timeout'); //express v4
const Scheduler = require('./helpers/scheduler');
const helmet = require("helmet");
const AWS = require('aws-sdk');

// Config Setup
const env = process.env.APP_ENV || 'dev';
let config = require(`./config/${env}-config.json`);
global.config = config;
global.rootPath = __dirname;
// S3
global.s3 = new AWS.S3({
  accessKeyId: global.config.storage.id,
  secretAccessKey: global.config.storage.key
});

var app = express();
app.use(logger('dev'));
app.use(helmet());

app.use(timeout('20m'));
app.use(haltOnTimedout);
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));
app.use(bodyParser.text({ type: 'application/xml' }));
app.use(function (req, res, next) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*"); // restrict it to the required domain
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers,X-Access-Token,X-Key,Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  } else {
    next();
  }
});
app.use(express.static('uploads'));
var accessLogStream = rfs.createStream(`${moment(new Date()).format('YYYY-MM-DD')}.log`, {
  interval: '1d', // rotate daily
  path: path.join(__dirname, 'logs', 'info')
});
// logger
app.use(morgan(function (tokens, req, res) {
  return [
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens.res(req, res, 'content-length'),
    tokens['response-time'](req, res),
    tokens['remote-addr'](req, res),
    tokens['user-agent'](req, res),
    tokens['date']('iso')
  ].join(' + ');
}, { stream: accessLogStream, flags: 'a', }));

// Any URL's that do not follow the below pattern should be avoided unless you
function haltOnTimedout(req, res, next) {
  if (!req.timedout) next();
}
// app.all('/*', [require('./middleware/feature-access-validator')]);
// app.use('/public', express.static(__dirname + '/public'));
// app.use('/uploads', express.static(__dirname + '/uploads'));
app.use('/public', express.static('public'));

// app.all('/pushData/*', [require('./middleware/validateERPRequest')]);

var api = require('./routes/')(app);

let workers = [];

/**
 * Setup number of worker processes to share port which will be defined while setting up server
 */
const setupWorkerProcesses = () => {
  // to read number of cores on system
  //let numCores = require('os').cpus().length;
  let numCores = 1;
  console.log('Master cluster setting up ' + numCores + ' workers');
  // iterate on number of cores need to be utilized by an application
  // current example will utilize all of them
  for (let i = 0; i < numCores; i++) {
    // creating workers and pushing reference in an array
    // these references can be used to receive messages from workers
    workers.push(cluster.fork());

    // to receive messages from worker process
    workers[i].on('message', function (message) {
      console.log(message);
    });
  }

  // process is clustered on a core and process id is assigned
  cluster.on('online', function (worker) {
    console.log('Worker ' + worker.process.pid + ' is listening');
  });

  // if any of the worker process dies then start a new one by simply forking another one
  cluster.on('exit', function (worker, code, signal) {
    console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
    console.log('Starting a new worker');
    cluster.fork();
    workers.push(cluster.fork());
    // to receive messages from worker process
    workers[workers.length - 1].on('message', function (message) {
      console.log(message);
    });
  });
};

/**
 * Setup an express server and define port to listen all incoming requests for this application
 */
const setUpExpress = () => {

  // create server
  app.server = http.createServer(app);


  // -----------------To know Request size
  // var stats = requestStats(app.server);
  // stats.on('complete', function (details) {
  //   var size = details.req.bytes;
  //   console.log(">>>>>>>>>>>>>>>>>>.size", size);
  // });
  // parse application/json
  app.use(bodyParser.json({
    limit: '2000000kb'
  }));
  app.disable('x-powered-by');

  // routes
  //setRouter(app);

  // start server
  let listen = app.server.listen(process.env.PORT, () => {
    console.log(`Started server on => http://localhost:${app.server.address().port} for Process Id ${process.pid}`);
    // manualSyncController.updateOrdeDetailsTables()
    // manualSyncController.manualImportCodes()
    // manualSyncController.generateStorageBins()
    // erpController.inventorySync();
    // manualSyncController.updateTablesVariables() //uncomment if u want to update dynamic tables
    // manualSyncController.updateStorageBins()
    // manualSyncController.updateLabelAndLeaflet()
    // manualSyncController.manualUpdateBatchLabelLeaflet()
    // qrCodeController.importPreviousCodes();
    // qrCodeController.importBatches()
  });

  listen.setTimeout(56000000); //10min

  // Scheduler.execute();
  // in case of an error
  app.on('error', (appErr, appCtx) => {
    console.error('app error', appErr.stack);
    console.error('on url', appCtx.req.url);
    console.error('with headers', appCtx.req.headers);
  });
};

/**
 * Setup server either with clustering or without it
 * @param isClusterRequired
 * @constructor
 */
const setupServer = (isClusterRequired) => {
  console.log('cluster master : ', cluster.isMaster);
  // if it is a master process then call setting up worker process
  if (isClusterRequired && cluster.isMaster) {
    setupWorkerProcesses();
  } else {
    // to setup server configurations and share port address for incoming requests
    setUpExpress();
  }
};

setupServer(false);
//app.listen(process.env.PORT, () => console.log('Server started at port : ' + process.env.PORT));





