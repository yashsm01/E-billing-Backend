const v = require('node-input-validator');
const vSecret = require('../../config/gsp-secret');
const parseValidate = require("../../middleware/parseValidate");
const jsonwebtoken = require('jsonwebtoken');
const logger = require('../../helpers/logger');
const companyUsers = require('../../models').company_users;
const CryptoJS = require("crypto-js");
const algorithm = 'aes-256-cbc'; //Using AES encryption
const SHA256 = require("crypto-js/sha256");
const bcrypt = require("bcryptjs");
const tokenConfig = require("../../config/token_config.json");
const sapSecret = require("../../config/sap_secret");
const key = CryptoJS.enc.Utf8.parse(sapSecret());
const iv1 = CryptoJS.enc.Utf8.parse(sapSecret());

const token = {
  generateAccessToken: async (req, res) => {
    try {
      let validator = new v(req.body, {
        username: 'required',
        password: 'required'
      });

      let matched = await validator.check();

      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res.status(200).send({ "success": 0, message: validatorError });
      }
      let encryptedusername = CryptoJS.AES.encrypt(req.body.username, key, {
        keySize: 16,
        iv: iv1,
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      });
      let encryptedpass = CryptoJS.AES.encrypt(req.body.password, key, {
        keySize: 16,
        iv: iv1,
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      });
      console.log("here enc>>", encryptedusername.toString(), encryptedpass.toString())

      let decUsernamebytes = CryptoJS.AES.decrypt(req.body.username, key, {
        keySize: 16,
        iv: iv1,
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      });
      let decUsername = decUsernamebytes.toString(CryptoJS.enc.Utf8);
      let decPasswordbytes = CryptoJS.AES.decrypt(req.body.password, key, {
        keySize: 16,
        iv: iv1,
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      });
      let decPassword = decPasswordbytes.toString(CryptoJS.enc.Utf8);
      console.log("deccc", decUsername, decPassword)
      let encUsername = decUsername, encPassword = decPassword;
      //find user
      let user = await companyUsers.findOne({
        where: {
          email: encUsername,
          role_id: 3
        },
        raw: true
      });
      if (!user) {
        return res.status(200).send({ success: 0, message: 'Invalid username or password' })
      }
      //check password
      const passCompare = await bcrypt.compare(
        encPassword,
        user.password
      );
      if (!passCompare) {
        return res.status(200).send({ success: 0, message: 'Invalid username or password' });
      }
      //sign jwt token
      let token = await jsonwebtoken.sign(
        {
          username: encUsername,
          password: encPassword
        },
        require("../../config/sap_jwt_secret")(),
        {
          algorithm: tokenConfig.algorithm,
          expiresIn: tokenConfig.expiresIn
        });

      await companyUsers.update({
        sap_jwt_token: token
      },
        {
          where: {
            id: user.id
          }
        }
      );

      return res.send({
        success: 1, token: token
      });


    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },

};

module.exports = token;