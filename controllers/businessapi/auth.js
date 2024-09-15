const uuid = require('uuid');
const v = require('node-input-validator');
const bcrypt = require('bcryptjs');

let parseValidate = require('../../middleware/parseValidate');
const msg = require('../../i18n/businessen');

const userDeviceDetail = require('../../models').user_device_detail;
const CompanyRole = require('../../models').company_roles;
const CompanyUser = require('../../models/').company_users;
const User_access = require('../../models/').user_platform_access;

//GLobal Joins

CompanyRole.hasMany(CompanyUser, { foreignKey: 'role_id' });
CompanyUser.belongsTo(CompanyRole, { foreignKey: 'role_id' });

const logger = require('../../helpers/logger');

let authcontroller = {

  login: async (req, res) => {
    try {
      let validator = new v(req.body, {
        email: 'required',
        password: 'required',
        device_type: 'required'
      });

      const matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      const businessUser = await CompanyUser.findOne({
        attributes: ['id', 'name', 'last_name', 'email', 'mobile_no', 'role_id', 'company_id', 'password', 'parent_id'],
        include: [
          {
            model: Companies,
            attributes: ['name']
          }
        ],
        where: {
          is_deleted: false,
          email: req.body.email
        }
      });
      if (!businessUser) {
        return res.status(200).send({ success: 0, message: msg.invalidLogin });
      }

      const checkAccess = await User_access.findOne({ where: { company_user_id: businessUser.id, trusttrack_access: true } })
      if (!checkAccess) {
        return res.status(200).send({ success: 0, message: msg.invalidAccess });
      }

      const checkPass = await bcrypt.compare(req.body.password, businessUser.dataValues.password);
      console.log(checkPass);
      if (!checkPass) {
        return res.status(200).send({ success: 0, message: msg.invalidLogin });
      }


      await userDeviceDetail.update({
        is_deleted: true
      }, {
        where: {
          user_id: businessUser.id,
          platform: 3
        }
      });


      let deviceInfos = {
        id: uuid.v4(),
        user_id: businessUser.id,
        platform: 3,
        device_type: req.body.device_type ? req.body.device_type : "",
        device_token: req.body.device_token ? req.body.device_token : "",
        os: req.body.os ? req.body.os : "",
        app_version: req.body.app_version ? req.body.app_version : 0,
        /*                 device_model:req.body.device_model ? req.body.device_model : "", */
        status: false,
        is_deleted: false
      };

      if (req.body.latitude && req.body.longitude) {
        deviceInfos.latitude = req.body.latitude ? req.body.latitude : "";
        deviceInfos.longitude = req.body.longitude ? req.body.longitude : "";
      }

      console.log("**login business***********")


      const businessDeviceDetail = await userDeviceDetail.create(deviceInfos);
      if (!businessDeviceDetail) {
        return res.status(200).send({ success: 0, message: 'faild to save login device information.' });
      }

      console.log("**login business***********", businessDeviceDetail)
      businessUser.dataValues.token = deviceInfos.id;

      return res.status(200).send({ success: 1, 'data': businessUser });

    } catch (ex) {
      logger.error(req, ex.message);
      return res.status(500).send({ success: 0, message: ex.message });
    }
  },

  //Hope api is not in use
  checkUserExists: async (req, res) => {
    try {
      let validator = new v(req.body, {
        mobile_no: 'required'
      });

      const matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      const businessUser = await CompanyUser.findOne({
        attributes: ['id', 'name', 'last_name', 'email', 'mobile_no', 'role_id', 'company_id', 'businessuser_parent_id'],
        include: [
          {
            model: Companies,
            attributes: ['name']
          },
          {
            model: BusinessRole,
            attributes: ['name', 'businessrole_parent_id']
          }
        ],
        where: {
          is_deleted: false,
          mobile_no: req.body.mobile_no
        }
      });
      if (!businessUser) {
        return res.status(200).send({ success: 0, message: msg.invalidLogin });
      }

      const isExistBusinessDeviceDetail = await userDeviceDetail.findOne({
        where: {
          is_deleted: false,
          user_id: businessUser.id
        }
      });
      if (!isExistBusinessDeviceDetail) {
        let deviceInfos = {};
        deviceInfos.id = uuid.v4();
        deviceInfos.business_user_id = businessUser.id;
        deviceInfos.device_type = req.body.device_type ? req.body.device_type : "";
        deviceInfos.device_token = req.body.device_token ? req.body.device_token : "";
        deviceInfos.os = req.body.os ? req.body.os : "";
        deviceInfos.app_version = req.body.app_version ? req.body.app_version : "";
        deviceInfos.device_model = req.body.device_model ? req.body.device_model : "";
        deviceInfos.is_deleted = false;

        if (req.body.latitude && req.body.longitude) {
          deviceInfos.latitude = req.body.latitude ? req.body.latitude : "";
          deviceInfos.longitude = req.body.longitude ? req.body.longitude : "";
        }
        const businessDeviceDetail = await BusinessDeviceDetail.create(deviceInfos);
        if (!businessDeviceDetail) {
          return res.status(200).send({ success: 0, message: 'faild to save login device information.' });
        }

        businessUser.dataValues.token = deviceInfos.id;
        businessUser.dataValues.alreadyLogin = 0;
      }
      else {
        businessUser.dataValues.alreadyLogin = 1;
      }

      return res.status(200).send({ success: 1, 'data': businessUser });
    } catch (ex) {
      logger.error(req, ex.message);
      return res.status(200).send({ success: 0, message: ex.message });
    }
  },

  checkDeviceToken: async (token, businessUserId) => {

    try {
      const businessUserDeviceInfo = await userDeviceDetail.findOne({
        where: {
          id: token,
          user_id: businessUserId,
          platform: 3,
          is_deleted: false
        }
      });

      if (!businessUserDeviceInfo) {
        return false;
      }

      return businessUserDeviceInfo;

    } catch (e) {
      return false;
    }
  },

  logout: async function (req, res) {

    try {
      if (!req.headers['x-key'] && !req.headers['x-access-token-']) {
        return res.status(200).send({ success: 0, message: "User id required" });
      }

      await userDeviceDetail.update({
        is_deleted: true
      }, {
        where: {
          user_id: req.headers['x-key'],
          platform: 3
        }
      });

      return res.status(200).send({ success: 1, message: "Logout successfully" });

    } catch (ex) {
      logger.error(req, ex.message);
      return res.status(500).send({ success: 0, message: ex.message });
    }


  }
};

module.exports = authcontroller;