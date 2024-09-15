const moment = require('moment');
const path = require('path');
const fs = require('fs');
const { identity } = require('lodash');

let error = async (req, message, identity = null) => {
    try {
        let filePath = path.join(global.rootPath, 'logs', 'errors', `${moment(new Date()).format('YYYY-MM-DD')}.json`);

        if (!fs.existsSync(filePath)) {
            await fs.writeFileSync(filePath, JSON.stringify([]));
        }

        let json = require(filePath)

        json.push({
            url: req.url,
            method: req.method,
            reqBody: (req.body) ? req.body : (req.params) ? req.params : req.query,
            message: message,
            time: new Date(),
            identity: identity
        });

        fs.writeFileSync(filePath, JSON.stringify(json));
    } catch (error2) {
        console.error(error2);
    }
};

let info = async (req, message, identity = null) => {
    try {
        let filePath = path.join(global.rootPath, 'logs', 'info', `${moment(new Date()).format('YYYY-MM-DD')}.json`);

        if (!fs.existsSync(filePath)) {
            await fs.writeFileSync(filePath, JSON.stringify([]));
        }

        // let json = require(filePath)

        // json.push({
        //     // url: req.url,
        //     // method: req.method,
        //     // reqBody: (req.body) ? req.body : (req.params) ? req.params : req.query,
        //     // orderId: req.body ? req.body.orderId : '',

        //     message: message,
        //     time: new Date(),
        //     identity: identity
        // });


        // fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
    } catch (error2) {
        console.error(error2);
    }
};

module.exports = {
    error: error,
    info: info
}
