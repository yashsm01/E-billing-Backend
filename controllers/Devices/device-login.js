const uuid = require('uuid');
const v = require('node-input-validator');
const bcrypt = require('bcryptjs');

const JWToken = require('jsonwebtoken');

const util = require('util');
const exec = util.promisify(require('child_process').exec);

const message = require('../../i18n/scanningen');
let parseValidate = require('../../middleware/parseValidate');
const mailer = require('../../helpers/mail');

//helper
const logger = require('../../helpers/logger');
const en = require('../../i18n/en');

//models 
const models = require("../_models");


//-------------------Main Functions--------------------------------------

const logout = async (req, res) => {
  try {
    let validator = new v(req.body, {
      employee_id: 'required',
      token: 'required'
    });

    let matched = await validator.check();
    if (!matched) {
      let validatorError = parseValidate(validator.errors);
      return res.status(200).send({
        'success': '0',
        'message': validatorError
      });
    }

    ///code pending

    if (isUpdated < 1) {
      return res.status(200).send({
        'success': '0',
        'message': message.logoutFailed
      });
    }
    return res.status(200).send({
      'success': '1',
      'message': message.logoutSuccess
    });

  } catch (ex) {
    logger.error(req, ex.message);
    return res.status(500).send({
      'success': '0',
      'message': ex.message
    });
  }
};


//----------------------End Main Function------------------------------

//-----------------------Sub Function ---------------------------------
async function checkAvailability() {
  try {
    const { stdout, stderr } = await exec('ping www.google.com');
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  logout
}