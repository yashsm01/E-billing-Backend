const v = require('node-input-validator');
const logger = require('../helpers/logger');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

const LoggerController = {
  getLogs: async function (req, res) {
    try {

      if (!req.headers['x-access-token'] || req.headers['x-access-token'] != '122loggertoken@TT') {
        return res.status(401).send({ message: "Unauthorized Access!" });
      }

      let dates = [moment(new Date()).format('YYYY-MM-DD')];

      if (req.query.startDate && req.query.endDate) {
        let startDate = new Date(req.query.startDate);
        let endDate = new Date(req.query.endDate);

        dates = await getDates(startDate, endDate);
      }

      let logs = {};

      for (let i = 0; i < dates.length; i++) {
        logs = Object.assign(logs, await getLogs(dates[i]));
      }

      return res.send({ success: 1, data: logs });

    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  }
};


async function getDates(startDate, endDate) {
  startDate = moment(startDate);
  endDate = moment(endDate);
  let diff = await endDate.diff(startDate, 'days');
  console.log('diff - ', diff);
  let dates = [startDate.format('YYYY-MM-DD')];
  for (let i = 0; i < diff; i++) {
    dates.push(startDate.add(1, 'days').format('YYYY-MM-DD'))
  }

  return dates;
}

async function getLogs(filename) {
  let filePath = path.join(global.rootPath, 'logs', 'errors', filename + '.json');
  console.log(filePath);
  if (fs.existsSync(filePath)) {
    console.log('exists');
    return {
      [filename]: JSON.parse(fs.readFileSync(filePath).toString())
    }
  } else {
    console.log('file not fount')
    return { [filename]: [] };
  }
}

module.exports = LoggerController;