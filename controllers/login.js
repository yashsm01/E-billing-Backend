const v = require("node-input-validator");
const bcrypt = require("bcryptjs");
const CryptoJS = require("crypto-js");
const JWT = require("jsonwebtoken");
const EJS = require("ejs");
const randomstring = require("randomstring");

const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const signAsync = promisify(jwt.sign);

let Sequelize = require("sequelize");
let Op = Sequelize.Op;

const message = require("../i18n/en");
let parseValidate = require("../middleware/parseValidate");

const CompanyUser = require("../models/").company_users;
const LocationModel = require("../models/").locations;
const Devices = require("../models/").devices;
const CompanyRoles = require("../models/").company_roles;

const LocationTracker = require('../helpers/customer-location-tracker');

const uuid = require('uuid');
const otpGenerator = require('otp-generator');
const axios = require('axios');
const crypto = require('crypto');
const password = process.env['CRYPT_PASSWORD'];
const iv = Buffer.from(process.env['IV']);
const ivstring = iv.toString('hex').slice(0, 16);
const moment = require('moment');

const OTP = require("../models/").otp;
const SalesPersons = require("../models/").sales_persons;
const Consumers = require("../models/").consumers;
const Product = require('../models/').products;
const ProductCategory = require("../models/").categories;
const ProductionOrderModel = require("../models").production_orders;
const MappingTransactionModel = require('../models').mapping_transactions;
const secondaryConsumers = require("../models/").dealer_mobileno;
const DynamicModels = require('../models/dynamic_models');
const DynamicUIDModel = require('../models/').dynamic_uids;
const DynamicLevelCodesModel = require('../models/').dynamic_level_codes

const models = require("./_models");
const logger = require("../helpers/logger.js");
const qrcodeController = require('../controllers/qr-codes-controller');
const order = require("./order.js");
const ChannelPartners = require("../models").channel_partners;
const Pincodes = require('../models/').pincodes;
const { passwordStrength } = require("check-password-strength");
const saltRounds = 10;
const { sendMail } = require("../helpers/mail");
const CONSTANT = require("../config/const")




const loginController = {
  companyLogin: async (req, res) => {
    try {
      let validator = new v(req.body, {
        email: "required|email",
        password: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        return res
          .status(200)
          .send({ success: 0, message: validator.errors });
      }
      const companyUser = await CompanyUser.findOne({
        where: {
          email: req.body.email,

          role_id: {
            [Op.in]: [0, 1, 2, 3, 8, 9, 16, 17, 18, 19, 20, 21]
          }
        },
        include: [
          {
            model: CompanyRoles,
            raw: true
          },
          {
            model: LocationModel,
            raw: true,
            attributes: ['id', 'unique_name']
          }
        ],
        raw: true,
        nest: true
      });
      if (!companyUser) {
        return res.status(200).send({ success: 0, message: message.invalidLogin });
      } else if (!companyUser.is_email_verified) {
        return res.send({ success: 0, message: message.emailNotVerified });
      } else if (!companyUser.is_password_updated) {
        return res.send({ success: 0, message: message.userPasswordExpired });
      }
      else if (
        companyUser.last_failed_login_at &&
        companyUser.failed_login_attempt_count &&
        (companyUser.failed_login_attempt_count >= CONSTANT.loginFailed.blockAfterAttempt)) {
        console.log("in else if");
        let startDate = moment(companyUser.last_failed_login_at);
        let endDate = moment(new Date());

        let duration = moment.duration(endDate.diff(startDate));
        let diff = CONSTANT.loginFailed.blockUnitType == "h" ? duration.asHours() : (CONSTANT.loginFailed.blockUnitType == "d") ? duration.asDays() : duration.asMinutes();

        console.log(diff);
        if (diff < CONSTANT.loginFailed.blockAfterUnit) {
          return res.send({ success: 0, message: CONSTANT.loginFailed.failedMessage });
        }
      }
      // else if (companyUser.old_password.length != 0) {
      //   let oldPassword = false;
      //   for (let i = 0; i < companyUser.old_password.length; i++) {
      //     let passwordCompare = await bcrypt.compare(
      //       req.body.password,
      //       companyUser.old_password[i].password
      //     );

      //     if (passwordCompare) {
      //       oldPassword = true;
      //       return res.status(200).send({ success: 0, message: 'You cannot set old password' });
      //     }
      //   }
      //   // if (companyUser.old_password.length == CONSTANT.old_password_trail) {
      //   //   companyUser.old_password.shift();
      //   // }
      // }
      // companyUser.old_password.push({ password: password });
      console.log("bef compare", req.body.password, companyUser.password);
      const passComapre = await bcrypt.compare(
        req.body.password,
        companyUser.password
      );

      if (!passComapre) {
        await CompanyUser.update({
          last_failed_login_at: new Date(),
          failed_login_attempt_count: ((companyUser.failed_login_attempt_count || 0) + 1)
        }, {
          where: {
            id: companyUser.id
          }
        });
        console.log("passw not matched");
        return res.status(200).send({ success: 0, message: message.invalidLogin });
      }

      let token = await jwt.sign(
        { user_token: companyUser.random_id, platform_id: 1 },
        require("../config/secret")(),
        {
          algorithm: "HS256",
          expiresIn: "24h",
        }
      );

      await CompanyUser.update(
        {
          jwt_token: token,
          last_failed_login_at: null,
          failed_login_attempt_count: null,
          last_activity_at: new Date(),
          // old_password: companyUser.old_password,
        },
        {
          where: {
            id: companyUser.id,
          },
        }
      );

      delete companyUser.failed_login_attempt_count;
      delete companyUser.last_failed_login_at;
      delete companyUser.password;
      // delete companyUser.old_password;

      let userEncryptedData = CryptoJS.AES.encrypt(JSON.stringify(companyUser), process.env.AdminPanelSecretKey).toString();

      return res.status(200).send({ success: 1, versionDetails: userEncryptedData, access_token: token });
    } catch (ex) {
      console.error(ex);
      logger.error(req, ex.message);
      return res.status(500).send({ success: 0, message: "Internal Server Error" });
    }
  },

  mappingAppLogin: async (req, res) => {
    try {
      let validator = new v(req.body, {
        email: "required|email",
        password: "required",
        deviceId: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res
          .status(200)
          .send({ success: 0, message: validatorError });
      }
      console.log("--<<Mapping Login request>>", req.body);
      let deviceDetail = await Devices.findOne({
        where: {
          u_id: req.body.deviceId
        },
        raw: true
      });
      if (!deviceDetail) {
        return res.status(200).send({ success: 0, message: "Device Not Registered" });
      }

      const companyUser = await CompanyUser.findOne({
        where: {
          email: req.body.email,
          role_id: {
            [Op.in]: [5, 6, 7]
          },
          location_id: deviceDetail.location_id
        },
        raw: true
      });

      if (!companyUser) {
        return res.status(200).send({ success: 0, message: message.invalidLogin });
      }
      console.log("bef compare", req.body.password, companyUser.password);
      const passComapre = await bcrypt.compare(
        req.body.password,
        companyUser.password
      );

      if (!passComapre) {
        await CompanyUser.update(
          {
            last_failed_login_at: new Date(),
            failed_login_attempt_count: ((companyUser.failed_login_attempt_count || 0) + 1)
          },
          {
            where: {
              id: companyUser.id
            }
          });
        console.log("passw not matched");
        return res.status(200).send({ success: 0, message: message.invalidLogin });
      }

      let token = await jwt.sign(
        {
          id: companyUser.random_id,
          device_id: deviceDetail.id
        },
        require("../config/secret")(),
        {
          algorithm: "HS256",
          expiresIn: "24h",
        }
      );
      // await CompanyUser.update(
      //     {
      //         jwt_token: token
      //     },
      //     {
      //         where: {
      //             id: companyUser.id
      //         }
      //     })
      let data = {
        name: companyUser.name,
        roleId: companyUser.role_id
      }

      return res.status(200).send({ success: 1, data: data, access_token: token });
    }
    catch (ex) {
      console.error(ex);
      logger.error(req, ex.message);
      return res.status(500).send({ success: 0, message: "Internal Server Error" });
    }
  },
  trustTrackLogin: async (req, res) => {
    try {
      let validator = new v(req.body, {
        did: "required",
        email: "required",
        password: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: 0, message: validator.errors[Object.keys(validator.errors)[0]].message });
      }

      let deviceInfo = await Devices.findOne({
        where: {
          u_id: req.body.did,
          is_active: true
        },
        raw: true
      })
      if (!deviceInfo) {
        console.log("-----------Invalid Device Id");
        return res.status(200).send({ success: 0, message: `Device Not Registered:: ${req.body.did}` })

      }

      CompanyUser.hasOne(LocationModel, {
        foreignKey: 'id',
        sourceKey: 'location_id'
      })

      let userDetails = await CompanyUser.findOne({
        where: {
          email: req.body.email,
          location_id: deviceInfo.location_id,
          role_id: {
            [Op.in]: [10, 11, 12, 13, 14]
          }
        },
        include: [
          {
            model: LocationModel,
            raw: true,
            attributes: ['id', 'unique_name']
          }
        ],
        attributes: ['id', 'role_id', 'name', 'email', 'mobile_no', 'password'],
        raw: true,
        nest: true
      });
      if (!userDetails) {
        console.log('---User Not Found--');
        return res.status(200).send({ success: 0, message: "Invalid Username Or Password" });
      }

      let checkPass = await bcrypt.compare(req.body.password, userDetails.password);

      if (!checkPass) {
        return res.status(200).send({ success: 0, message: "Invalid Username Or Password" });
      }

      userDetails.location_name = userDetails.location.unique_name
      delete userDetails.location
      delete userDetails.password


      const token = await createJWT(userDetails.id, userDetails.location_id, deviceInfo.id);

      if (!token) {
        return res.status(200).send({ success: 0, message: "Token Genration Failed!" })
      }

      // Allowing same user to login to multiple devices

      // await UserModel.update(
      //     {
      //         jwt_token: token
      //     },
      //     {
      //         where: {
      //             id: validateUserInfo.userDetails.id
      //         }
      //     })
      return res.send({ success: 1, message: "Login Successfull!", access_token: token, data: userDetails })

    } catch (error) {
      logger.error(req, error.message);
      console.log(error)
      return res.status(500).send({ success: 0, message: "Oops! Somthing went wrong!" });
    }
  },

  getUserocationInfo: async (req, res) => {
    try {
      console.log("location api");
      let validator = new v(req.query, {
        latitude: "required",
        longitude: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      console.log(req.query)
      // find pincode according latitude longitude
      // const toleranceLatitude = 0.0001;
      // const toleranceLongitude = 0.000001;
      // const tolerance = 0.000001;
      // const tolerance = 0.000001;
      const tolerance = 0.1;

      const toleranceLatitude = tolerance;
      const toleranceLongitude = tolerance;


      req.query.latitude = Number(req.query.latitude)
      req.query.longitude = Number(req.query.longitude)

      let lat = Number(req.query.latitude).toFixed(4)
      let long = Number(req.query.longitude).toFixed(4)

      lat = parseFloat(lat);
      long = parseFloat(long);
      console.log("type>>>", typeof (lat));
      console.log("type>>>", typeof (long));
      console.log("lat>>>", lat);
      console.log("long>>>", long);
      // const radiusInKm = 50;
      const radiusInKm = 34;
      // const cityInfo1 = await models.pincodeModel.findOne({
      //   // attributes: ['latitude', 'longitude'],
      //   order: Sequelize.literal(`
      //     ST_Distance(
      //       ST_MakePoint("pincodes"."longitude", "pincodes"."latitude")::geography,
      //       ST_MakePoint(${long}, ${lat})::geography
      //     ) ASC
      //   `),
      //   raw: true,
      // });

      let cityInfo =
        await models.pincodeModel.findOne({
          order: [
            Sequelize.literal(`
            point(latitude, longitude) <-> point(${lat}, ${long})
          `),
          ],
          // limit: 1,

          raw: true,
        });
      // where: {
      //   latitude : req.query.latitude,
      //   longitude: req.query.longitude
      // },
      //   where:Sequelize.literal(
      //     `ST_DWithin(
      //       ST_MakePoint(${long}, ${lat})::geography,
      //       ST_MakePoint("pincodes"."longitude", "pincodes"."latitude")::geography,
      //       ${radiusInKm * 1000}
      //     )`,
      //   ),
      //   // attributes: ['latitude', 'longitude'],
      //   // order: [
      //   //   [
      //   //     Sequelize.fn(
      //   //       'ST_Distance',
      //   //       Sequelize.fn(
      //   //         'ST_MakePoint',
      //   //         Sequelize.col('pincodes.longitude'),
      //   //         Sequelize.col('pincodes.latitude')
      //   //       ),
      //   //       Sequelize.fn('ST_MakePoint', long, lat),
      //   //       true
      //   //     ),
      //   //     'ASC',
      //   //   ],
      //   // ],
      //   raw: true
      // });
      // where:
      // {
      // latitude: {
      //   [Sequelize.Op.between]: [
      //       req.query.latitude - toleranceLatitude,
      //       req.query.latitude + toleranceLatitude
      //   ],
      // },
      // longitude: {
      //   [Sequelize.Op.between]: [
      //       req.query.longitude - toleranceLongitude,
      //       req.query.longitude + toleranceLongitude
      //   ],
      // },
      // latitude: {
      //   [Sequelize.Op.between]: [lat - tolerance, lat + tolerance],
      // },
      // longitude: {
      //   [Sequelize.Op.between]: [long- tolerance, long + tolerance],
      // },
      // latitude: {
      //   [Op.between]: [lat - (0.009 * radiusInKm), lat + (0.009 * radiusInKm)],
      // },
      // longitude: {
      //   [Op.between]: [long - (0.009 * radiusInKm), long + (0.009 * radiusInKm)],
      // },

      //   },
      //     order: [
      //       [Sequelize.literal(`ABS(latitude - ${lat})`), 'ASC'],
      //       [Sequelize.literal(`ABS(longitude - ${long})`), 'ASC'],
      //   ], // Order by the absolute difference to get the closest first
      //   raw: true
      // });

      // console.log(`>>>>>>>>Tolerance ${lat - tolerance} >>> ${lat + tolerance}`);
      // console.log(`>>>>>>>>Tolerance ${long - tolerance} >>> ${long + tolerance}`);

      // console.log(">>>>>>>>>>>>>>>>>>", lat - (0.009 * radiusInKm), lat + (0.009 * radiusInKm));
      // console.log(">>>>>>>>>>>>>>>>>>", long - (0.009 * radiusInKm), long + (0.009 * radiusInKm));
      console.log("type>>>", typeof (lat));
      console.log("type>>>", typeof (long));

      console.log("city info", cityInfo);

      if (!cityInfo) {
        return res.status(200).send({ success: 0, message: "Unable to find your location" });
      }

      // console.log("last city info>>>>", cityInfo[cityInfo.length-1])
      return res.status(200).send({ success: 1, data: cityInfo });
    } catch (error) {
      logger.error(req, error.message);
      console.log("messs", error)
      return res.status(500).send({
        'success': '0',
        'message': error.message
      });
    }
  },

  checkCustomerExists: async (req, res) => {
    try {

      console.log('+++++++++++++++++++++++++', req.query);
      let validator = new v(req.query, {
        country_code: "required",
        phone: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res.status(200).send({ success: '0', message: validatorError })
      }
      let myStr = req.query.country_code;
      let newStr = myStr.replace(/ /g, '+');
      req.query.country_code = newStr;

      // check normal consumer exist
      let priConsumerDetails = await Consumers.findOne({
        where: {
          phone: req.query.phone,
          country_code: req.query.country_code,
          is_deleted: {
            [Op.ne]: true
          }
          // is_deleted:false
        },
        raw: true,
        nest: true
      });
      console.log("--Primary Consumer Details::", priConsumerDetails);
      if (priConsumerDetails) {
        return res.status(200).send({ success: 1, isExists: true })
      }

      // check for channel partner
      let channelPartner = await ChannelPartners.findOne({
        where: {
          phone: req.query.phone,
          country_code: req.query.country_code,
          is_deleted: {
            [Op.ne]: true
          }
          // is_deleted:false
        },
        raw: true,
        nest: true
      });
      console.log("--Channel Partner Details::", channelPartner);
      if (channelPartner) {
        return res.status(200).send({ success: 1, isExists: true })
      }

      // secondary channel partner
      // let secChannelPartner = await secondaryConsumers.findOne({
      //   where: {
      //     phone: req.query.phone,
      //     country_code: req.query.country_code,
      //     is_deleted: {
      //       [Op.ne]: true
      //     }
      //   },
      //   raw: true,
      //   nest: true
      // });
      // console.log("--Sec Channel Partner Details::", secChannelPartner);
      // if (secChannelPartner) {
      //   return res.status(200).send({ success: 1, isExists: true })
      // }

      // new consumer come
      return res.status(200).send({ success: 1, isExists: false })
    } catch (ex) {
      console.log(ex);
      logger.error(req, ex.message);
      return res.status(500).send({ success: 0, message: "Some Internal Error" });
    }
  },
  sendOtp: async (req, res) => {
    try {
      let validator = new v(req.body, {
        'phone': "required"
      })
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError })
      }
      // let blockStatus = await ConsumerBlockStatus.findOne({
      //     where: { phone: req.body.phone.toString() },
      //     attributes: ['id', 'last_otp_sent_at', 'no_of_otp_sent', 'last_failed_login_at', 'failed_login_attempt_count'],
      //     raw: true
      // });
      // if (blockStatus) {
      //     let today = moment(new Date());
      //     if (blockStatus.last_failed_login_at) {
      //         let lastLoginFailedAt = moment(blockStatus.last_failed_login_at);
      //         let failedDuration = moment.duration(today.diff(lastLoginFailedAt));
      //         var diff = CONSTANT.otpBlockConfig.blockUnitType == "h" ? failedDuration.asHours() : (CONSTANT.otpBlockConfig.blockUnitType == "d") ? failedDuration.asDays() : failedDuration.asMinutes();
      //         if (diff < CONSTANT.otpBlockConfig.blockAfterUnit && blockStatus.failed_login_attempt_count >= CONSTANT.otpBlockConfig.blockAfterAttempt) {
      //             return res.send({ success: 0, message: CONSTANT.otpBlockConfig.failedMessage })
      //         }
      //     }
      //     let lastOtpSentAt = moment(blockStatus.last_otp_sent_at);
      //     let duration = moment.duration(today.diff(lastOtpSentAt));
      //     var timeDiff = CONSTANT.otpBlockConfig.blockUnitType == "h" ? duration.asHours() : (CONSTANT.otpBlockConfig.blockUnitType == "d") ? duration.asDays() : duration.asMinutes();
      //     // console.log("OTP Diff", timeDiff);
      //     // console.log("OTP Count", blockStatus.no_of_otp_sent);
      //     // console.log("------Time condition", timeDiff < CONSTANT.otpBlockConfig.blockAfterUnit);
      //     // console.log("------Attempt Condition", blockStatus.no_of_otp_sent >= CONSTANT.otpBlockConfig.blockAfterAttempt)
      //     if (timeDiff < CONSTANT.otpBlockConfig.blockAfterUnit && blockStatus.no_of_otp_sent >= CONSTANT.otpBlockConfig.blockAfterAttempt) {
      //         return res.status(200).send({ success: 0, message: "Your OTP limit reached, please try again after 1 hour!" })
      //     }
      // }

      const otp = otpGenerator.generate(6, { digits: true, upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
      // const otp = 123456;

      const now = new Date();
      const expiration_time = AddMinutesToDate(now, 10);

      const otp_instance = await OTP.create({
        otp: otp,
        expiration_time: expiration_time
      });
      var details = {
        "timestamp": now,
        "phone": req.body.phone,
        "success": true,
        message: "OTP sent to user",
        "otp_id": otp_instance.id
      }
      const encoded = await encode(JSON.stringify(details))

      let otpConfig = global.config.otp;
      console.log("Config::", otpConfig.apikey);

      let response = await axios.get(`https://api.textlocal.in/send/?apikey=${global.config.otp.apiKey}=&numbers=${req.body.phone}&sender=${global.config.otp.sender}&custom=${global.config.otp.custom}&message=Your one time password is ${otp}. Kindly do not share it with anyone VIVIDE`);
      console.log("-------", response);
      console.log("-------", response.data.errors);
      if (response.data.status != 'success') {
        return res.status(200).send({ success: 0, message: "Some error in sending otp" })
      }

      console.log("----------------------------------------OTP::", otp);

      // if (blockStatus) {
      //     // Counting users login attempts  and considering this as failed login
      //     // console.log("--BlockStatus", blockStatus)
      //     let obj = {
      //         last_otp_sent_at: new Date(),
      //         no_of_otp_sent: blockStatus.no_of_otp_sent + 1
      //     };
      //     if (blockStatus.no_of_otp_sent >= CONSTANT.otpBlockConfig.blockAfterAttempt) {
      //         obj.no_of_otp_sent = 1;
      //     }
      //     await ConsumerBlockStatus.update(obj, {
      //         where: {
      //             phone: req.body.phone
      //         }
      //     });
      // }
      // else {
      //     await ConsumerBlockStatus.create({
      //         id: uuid.v4(),
      //         phone: req.body.phone,
      //         last_otp_sent_at: new Date(),
      //         no_of_otp_sent: 1
      //     })
      // }

      return res.status(200).send({ success: 1, data: encoded });

    } catch (error) {
      console.log(error);
      return res.status(500).send({ success: 0, message: "Some Internal Error" })
    }
  },
  verifySignupDetails: async (req, res) => {
    try {
      let validator = new v(req.body, {
        name: 'required',
        country_code: "required",
        phone: "required",
        // email: "required",
        pincode: 'required',
      });
      let matched = await validator.check()
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      if (!req.body.email) {
        // console.log("email nhi h")
        return res.status(200).send({ success: 1, message: 'OK' })
      }
      let emailExists = await Consumers.findOne({
        where: {
          email: req.body.email
        }
      })
      if (emailExists) {
        return res.status(200).send({ success: 0, message: "Email is in use" })
      }
      return res.status(200).send({ success: 1, message: 'OK' })
    } catch (error) {
      console.log(error);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },
  verifyOtp: async (req, res) => {
    try {
      let currentdate = new Date();
      let validator = new v(req.body, {
        'verification_key': "required",
        "otp": "required",
        "phone": "required"
      })
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError })
      }

      // let blockStatus = await ConsumerBlockStatus.findOne({
      //     where: { phone: req.body.phone },
      //     attributes: ['id', 'last_otp_sent_at', 'no_of_otp_sent', 'last_failed_login_at', 'failed_login_attempt_count', 'phone'],
      //     raw: true
      // });
      // if (blockStatus) {

      //     let today = moment(new Date());
      //     if (blockStatus.last_failed_login_at) {
      //         let lastLoginFailedAt = moment(blockStatus.last_failed_login_at);
      //         let failedDuration = moment.duration(today.diff(lastLoginFailedAt));
      //         var diff = CONSTANT.otpBlockConfig.blockUnitType == "h" ? failedDuration.asHours() : (CONSTANT.otpBlockConfig.blockUnitType == "d") ? failedDuration.asDays() : failedDuration.asMinutes();
      //         // console.log("--herere-", blockStatus);
      //         // console.log("OTP Diff", diff);
      //         // console.log("OTP Count", blockStatus.failed_login_attempt_count);
      //         // console.log("------Time condition", diff < CONSTANT.otpBlockConfig.blockAfterUnit);
      //         // console.log("------Attempt Condition", blockStatus.failed_login_attempt_count >= CONSTANT.otpBlockConfig.blockAfterAttempt)
      //         if (diff < CONSTANT.otpBlockConfig.blockAfterUnit && blockStatus.failed_login_attempt_count >= CONSTANT.otpBlockConfig.blockAfterAttempt) {
      //             return res.send({ success: 0, message: CONSTANT.otpBlockConfig.failedMessage })
      //         }
      //     }
      // }

      let decoded = await decode(req.body.verification_key);
      let obj = JSON.parse(decoded)
      if (obj.phone != req.body.phone) {
        return res.status(200).send({ success: 0, message: "OTP was not sent to this particular email or phone number" })
      }
      let otp_instance = await OTP.findOne({ where: { id: obj.otp_id } });
      if (!otp_instance) {
        return res.status(200).send({ success: 0, message: "Instance Not Found." })
      }
      //Check if OTP is already used or not
      if (otp_instance.verified) {
        return res.status(200).send({ success: 0, message: "OTP Already Used" })
      }

      //Check if OTP is expired or not
      if (compareDates(otp_instance.expiration_time, currentdate) != 1) {
        return res.status(200).send({ success: 0, message: "OTP Expired" })
      }
      //Check if OTP is equal to the OTP in the DB
      if (req.body.otp != otp_instance.otp) {
        // await ConsumerBlockStatus.update({
        //     last_failed_login_at: new Date(),
        //     failed_login_attempt_count: ((blockStatus.failed_login_attempt_count || 0) + 1)
        // }, {
        //     where: {
        //         phone: req.body.phone
        //     }
        // });
        return res.status(200).send({ success: 0, message: "Invalid OTP" })
      }
      // Mark OTP as verified or used
      otp_instance.verified = true
      otp_instance.save();

      // delete otp instance
      otp_instance.destroy()

      // check if consumer
      let encryptedData;

      let priConsumerDetails = await Consumers.findOne({
        where: {
          phone: req.body.phone,
        },
        raw: true
      });
      if (priConsumerDetails) {
        let token = await jwt.sign({ userId: priConsumerDetails.id }, require("../config/secret")(), {
          algorithm: "HS256", expiresIn: "7d"
        });
        priConsumerDetails.jwt_token = token;
        encryptedData = CryptoJS.AES.encrypt(JSON.stringify(priConsumerDetails), process.env.PWASecretKey).toString();

        await Consumers.update({
          jwt_token: token,
        }, {
          where: {
            phone: req.body.phone
          }
        });
        return res.status(200).send({ success: 1, data: encryptedData })
      }

      // channer partner
      let channelPartner = await ChannelPartners.findOne({
        where: {
          phone: req.body.phone,
        },
        raw: true
      });
      if (channelPartner) {
        let token = await jwt.sign({ userId: channelPartner.id }, require("../config/secret")(), {
          algorithm: "HS256", expiresIn: "7d"
        });
        channelPartner.jwt_token = token;
        encryptedData = CryptoJS.AES.encrypt(JSON.stringify(channelPartner), process.env.PWASecretKey).toString();
        console.log("channel partner>>>>", channelPartner);
        await ChannelPartners.update({
          jwt_token: token,
        }, {
          where: {
            phone: req.body.phone
          }
        });
        return res.status(200).send({ success: 1, data: encryptedData })
      }

      // Sec Channel Partner
      // let secChannelPartner = await secondaryConsumers.findOne({
      //   where: {
      //     phone: req.body.phone,
      //     is_deleted: {
      //       [Op.ne]: true
      //     }
      //   },
      //   raw: true,
      // });
      // console.log("--Sec Channel Partner Details::", secChannelPartner);
      // if (secChannelPartner) {
      //   let token = await jwt.sign({ userId: secChannelPartner.id }, require("../config/secret")(), {
      //     algorithm: "HS256", expiresIn: "7d"
      //   });
      //   secChannelPartner.jwt_token = token;
      //   encryptedData = CryptoJS.AES.encrypt(JSON.stringify(secChannelPartner), process.env.PWASecretKey).toString();
      //   console.log("sec channel partner>>>>", secChannelPartner);
      //   await secondaryConsumers.update({
      //     jwt_token: token,
      //   }, {
      //     where: {
      //       phone: req.body.phone
      //     }
      //   });
      //   return res.status(200).send({ success: 1, data: encryptedData })
      // }

      // Auto signup as OTP verified
      if (req.body.email) {
        let emailExists = await Consumers.findOne({
          where: {
            email: req.body.email
          }
        })
        if (emailExists) {
          return res.status(200).send({ success: 0, message: "Email is in use" })
        }
      }
      // let emailExists = await Consumers.findOne({
      //   where: {
      //     email: req.body.email
      //   }
      // })
      // if (emailExists) {
      //   return res.status(200).send({ success: 0, message: "Email is in use" })
      // }
      let newConsumerId = uuid.v4();
      let token = await jwt.sign({ userId: newConsumerId }, require("../config/secret")(), {
        algorithm: "HS256", expiresIn: "7d"
      });

      let userAddressInfo = await getStateAndCityId(parseInt(req.body.pin_code));
      if (userAddressInfo == 0) {
        return
      }
      console.log("userAddress Info", userAddressInfo);

      let new_consumer = await Consumers.create({
        id: newConsumerId,
        role_id: 0,
        // type: 0,
        name: req.body.name,
        country_code: '+91',
        phone: req.body.phone.toString(),
        address: req.body.address,
        state_id: userAddressInfo.state_id ? userAddressInfo.state_id : null,
        city_id: userAddressInfo.city_id ? userAddressInfo.city_id : null,
        pin_code: req.body.pin_code ? parseInt(req.body.pin_code) : null,
        is_verified: true,
        email: req.body.email ? req.body.email : null,
        jwt_token: token,
        // dob: req.body.dob
        is_deleted: false,
        is_consumer: true
      })
      encryptedData = CryptoJS.AES.encrypt(JSON.stringify(new_consumer), process.env.PWASecretKey).toString();

      return res.status(200).send({ success: 1, data: encryptedData })

    } catch (error) {
      console.log(error);
      return res.status(500).send({ success: 0, message: "Some Internal Error" })
    }
  },
  getCustomerDetail: async (req, res) => {
    try {
      console.log("*****", process.env.PWASecretKey);
      let validator = new v(req.query, {
        country_code: "required",
        phone: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res.status(200).send({ success: '0', message: validatorError })
      }
      let myStr = req.query.country_code;
      let newStr = myStr.replace(/ /g, '+');
      req.query.country_code = newStr;

      let secConsumerDetails = await secondaryConsumers.findOne({
        where: {
          mobile_no: req.query.phone,
          country_code: req.query.country_code,
          is_deleted: {
            [Op.ne]: true
          }
          // is_deleted: false
        },
        raw: true,
        attributes: ['id', 'dealer_id', 'mobile_no']
      });

      if (secConsumerDetails) {
        let priConsumerDetails = await Consumers.findOne({
          where: {
            id: secConsumerDetails.dealer_id
          },
          raw: true
        });
        let obj = {
          id: secConsumerDetails.id,
          mobile: secConsumerDetails.mobile_no,
        }

        if (!priConsumerDetails) {
          return res.status(200).send({ success: '0', data: '' })
        }
        else {
          return res.status(200).send({ success: '1', data: obj })
        }
      }
      else {
        let priConsumerDetails = await Consumers.findOne({
          where: {
            phone: req.query.phone,
            country_code: req.query.country_code,
            is_deleted: {
              [Op.ne]: true
            }
            // is_deleted: false 
          },
          raw: true
        });
        if (priConsumerDetails) {
          let token = await jwt.sign(
            { user_token: priConsumerDetails.id },
            require("../config/secret")(),
            {
              algorithm: "HS256",
              expiresIn: "7d"
            });
          priConsumerDetails.jwt_token = token;
          let encryptedData = CryptoJS.AES.encrypt(JSON.stringify(priConsumerDetails), process.env.PWASecretKey).toString();
          return res.status(200).send({ success: '1', data: encryptedData });
        } else {
          // let salesPersonDetails = await SalesPerson.findOne({
          //   where: {
          //     phone: req.query.phone,
          //     country_code: req.query.country_code,
          //     is_deleted: false
          //   },
          //   raw: true
          // });

          // if (salesPersonDetails) {
          //   let encryptedData = CryptoJS.AES.encrypt(JSON.stringify(salesPersonDetails), process.env.PWASecretKey).toString();
          //   return res.status(200).send({ success: '1', data: encryptedData })
          // } else {
          return res.status(200).send({ success: '0', message: 'invalid phone no' });
          //}
        }

      }

    } catch (ex) {
      console.log(ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
  updateCustomerDetails: async (req, res) => {
    try {
      let validator = new v(req.body, {
        name: 'required',
        dob: 'required',
        phone: 'required',
        stateId: 'required',
        cityId: 'required',
        address1: 'required',
        gender: "required",
        pincode: "required",
        // email: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: '0', message: validatorError })
      }
      console.log("Phone", req.body.phone.substring(3));
      let cp = false;
      let consumer_detail = await Consumers.findOne({
        where: {
          phone: req.body.phone.substring(3)
        },
        raw: true,
      })

      let channelPartner = await ChannelPartners.findOne({
        where: {
          phone: req.body.phone.substring(3)
        },
        raw: true,
      });

      if (channelPartner) {
        cp = true;
      }

      if (!consumer_detail && !channelPartner) {
        return res.status(200).send({ success: '0', message: 'Consumer Not Found' })
      }

      if (req.body.email) {
        let checkEmail = await Consumers.findOne({
          where: {
            email: req.body.email,
            phone: {
              [Op.ne]: req.body.phone.substring(3)
            }
          },
          raw: true,
        })
        if (checkEmail) {
          return res.status(200).send({ success: '0', message: 'Email is in use' })
        }

        let checkEmailCP = await ChannelPartners.findOne({
          where: {
            email: req.body.email,
            phone: {
              [Op.ne]: req.body.phone.substring(3)
            }
          }
        });

        if (checkEmailCP) {
          return res.status(200).send({ success: '0', message: 'Email is in use' })
        }
      }
      // let checkEmail = await Consumers.findOne({
      //   where: {
      //     email: req.body.email,
      //     phone: {
      //       [Op.ne]: req.body.phone.substring(3)
      //     }
      //   },
      //   raw: true,
      // })
      // if (checkEmail) {
      //   return res.status(200).send({ success: '0', message: 'Email is in use' })
      // }

      // let checkEmailCP = await ChannelPartners.findOne({
      //   where: {
      //     email: req.body.email,
      //     phone: {
      //       [Op.ne]: req.body.phone.substring(3)
      //     }
      //   }
      // });

      // if (checkEmailCP) {
      //   return res.status(200).send({ success: '0', message: 'Email is in use' })
      // }

      let dob = moment(req.body.dob + " 00:00:00").tz("asia/calcutta").format()
      let doa;
      if (req.body.doa) {
        doa = moment(req.body.doa + " 00:00:00").tz("asia/calcutta").format()
      }

      console.log("dob", dob);
      console.log("dob", doa);
      await Consumers.update({
        name: req.body.name,
        gender: req.body.gender,
        email: req.body.email ? req.body.email : null,
        dob: dob,
        doa: doa ? doa : null,
        address: req.body.address1 + "/" + req.body.address2,
        state_id: req.body.stateId,
        city_id: req.body.cityId,
        pin_code: req.body.pincode,
        // is_profile_updated: true // column removed
      }, {
        where: {
          phone: req.body.phone.substring(3)
        }
      });

      if (cp) {
        await ChannelPartners.update({
          name: req.body.name,
          gender: req.body.gender,
          email: req.body.email,
          dob: dob,
          doa: doa ? doa : null,
          address: req.body.address1 + "/" + req.body.address2,
          state_id: req.body.stateId,
          city_id: req.body.cityId,
          pin_code: req.body.pincode,
        }, {
          where: {
            phone: req.body.phone.substring(3)
          }
        });
      }

      return res.status(200).send({ success: '1', message: 'updated' })
    }
    catch (error) {
      console.log("error in ", error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },

  scanningLogin: async (req, res) => {
    try {
      let validator = new v(req.body, {
        email: "required|email",
        password: "required",
        deviceId: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res
          .status(200)
          .send({ success: 0, message: validatorError });
      }
      console.log("--<<Mapping Login request>>", req.body);
      let deviceDetail = await Devices.findOne({
        where: {
          u_id: req.body.deviceId
        },
        raw: true
      });
      if (!deviceDetail) {
        return res.status(200).send({ success: 0, message: "Device Not Registered" });
      }

      const companyUser = await CompanyUser.findOne({
        where: {
          email: req.body.email,
          // role_id: {
          //   [Op.in]: [5, 6, 7]
          // },
          location_id: deviceDetail.location_id
        },
        raw: true
      });

      if (!companyUser) {
        return res.status(200).send({ success: 0, message: message.invalidLogin });
      }
      console.log("bef compare", req.body.password, companyUser.password);
      const passComapre = await bcrypt.compare(
        req.body.password,
        companyUser.password
      );

      if (!passComapre) {
        await CompanyUser.update(
          {
            last_failed_login_at: new Date(),
            failed_login_attempt_count: ((companyUser.failed_login_attempt_count || 0) + 1)
          },
          {
            where: {
              id: companyUser.id
            }
          });
        console.log("passw not matched");
        return res.status(200).send({ success: 0, message: message.invalidLogin });
      }

      // console.log("----secrets::", secrets.mappingSecret);
      let token = await jwt.sign(
        {
          id: companyUser.random_id,
          device_id: deviceDetail.id
        },
        require("../config/secret")(),
        {
          algorithm: "HS256",
          expiresIn: "24h",
        }
      );
      await CompanyUser.update(
        {
          jwt_token: token
        },
        {
          where: {
            id: companyUser.id
          }
        })
      let data = {
        name: companyUser.name,
        roleId: companyUser.role_id
      }

      return res.status(200).send({ success: 1, data: data, access_token: token });
    }
    catch (ex) {
      console.error(ex);
      logger.error(req, ex.message);
      return res.status(500).send({ success: 0, message: "Internal Server Error" });
    }
  },
  signup: async (req, res) => {
    try {
      let validatoryConfig = {
        name: "required",
        phoneNo: "required",
        email: "required|email",
        password: "required",
      }

      let validator = new v(req.body, validatoryConfig);

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({
          success: 0,
          message: validatorError
        });
      }

      req.body.phoneNo = req.body.phoneNo.toString()

      let isRetailerExists = await models.RetailerModel.findOne({
        where: {
          [Op.or]: {
            email: req.body.email,
            mobile_no: req.body.phoneNo,
          }
        },
      })

      if (isRetailerExists) {
        return res.status(200).send({ success: 0, message: "Retailer Already Exists." })
      }

      let isExisting = await CompanyUser.findOne({
        where: {
          [Op.or]: {
            email: req.body.email,
            mobile_no: req.body.phoneNo,
          }
        }
      })

      if (isExisting) {
        return res.status(200).send({ success: 0, message: "User Already Exists." })
      }

      let str = passwordStrength(req.body.password).value;
      if (str != "Strong") {
        return res.status(200).send({ success: 0, message: "Weak Password" });
      }

      const salt = await bcrypt.genSalt(saltRounds);
      const password = await bcrypt.hash(req.body.password, salt);
      let tableUid = moment(new Date()).format('MM_YYYY');
      let retailerId = uuid()
      let retailerObj = {
        id: retailerId,
        name: req.body.name,
        email: req.body.email,
        mobile_no: req.body.phoneNo,
        table_uid: tableUid
      }

      let userObj = {
        id: uuid(),
        role_id: 1,
        name: req.body.name,
        mobile_no: req.body.phoneNo,
        email: req.body.email,
        password: password,
        is_email_verified: false,
        is_approved: true,
        random_id: randomstring.generate(15),
        retailer_id: retailerId
      }
      await models.RetailerModel.create(retailerObj)
      await models.CompanyUserModel.create(userObj);

      let emailVerificationToken = await generateEmailVerificationToken(req.body.email);

      await sendEmailVerificationMail(emailVerificationToken, req.body.email);
      return res.status(200).send({ success: 1, message: "Signup Successfull" });

    } catch (ex) {
      console.error(ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
  emailVerification: async (req, res) => {
    const successTemplate = global.rootPath + "/templates/html/email-verification-success.html";
    const failedTemplate = global.rootPath + "/templates/html/email-verification-failed.html";
    const expiredTemplate = global.rootPath + "/templates/html/email-verification-token-expired.html";
    const alreadyVerified = global.rootPath + "/templates/html/email-verification-already-completed.html";
    const oldEmailVerificationLink = global.rootPath + "/templates/html/email-old-verification-link.html"
    console.log("alreadyVerified", alreadyVerified);
    try {

      let validator = new v(req.query, {
        token: "required"
      });

      let matched = await validator.check();

      if (!matched) {
        return res.sendFile(failedTemplate);
      }

      let decodedToken = await JWT.verify(req.query.token, global.config.jwt.emaiVerification.privateKey);
      console.log("-", decodedToken)
      if (!decodedToken || !decodedToken.email) {
        return res.sendFile(failedTemplate)
      }

      let userInfo = await CompanyUser.findOne({
        where: {
          email: decodedToken.email,
          // is_deleted: false,
          // status: true
        },
        attributes: ['is_email_verified'],
        raw: true
      });

      console.log(">>>>>userInfo", userInfo);

      if (!userInfo) {
        return res.sendFile(failedTemplate);
      }
      else if (userInfo.is_email_verified) {
        return res.sendFile(alreadyVerified);
      }
      // else if (userInfo.email_verification_token != req.query.token)
      //   return res.sendFile(oldEmailVerificationLink);

      await CompanyUser.update({
        is_email_verified: true,
        // email_verification_token: null
      }, {
        where: {
          email: decodedToken.email
        }
      });

      return res.sendFile(successTemplate);
    } catch (error) {
      console.log(error)
      logger.error(req, error.message);
      if (error.name == 'JsonWebTokenError' || error.name == 'TokenExpiredError') {
        return res.sendFile(error.name == 'JsonWebTokenError' ? failedTemplate : expiredTemplate);
      } else
        return res.sendFile(failedTemplate);
    }
  },
  verifyUserForForgetPassword: async (req, res) => {
    try {
      let validator = new v(req.body, {
        email: "required"
      });

      let matched = await validator.check();

      if (!matched) {
        console.log(validator.errors);
        return res
          .status(422)
          .send({
            success: 0,
            message: validator.errors[Object.keys(validator.errors)[0]].message
          });
      }

      let userInfo = await CompanyUser.findOne({
        where: {
          email: req.body.email,
          // is_deleted: false,
        },
        attributes: ['id', 'is_email_verified', 'name'],
        raw: true
      });

      if (!userInfo) {
        return res.send({ success: 0, message: "User Not Found!" });
      }
      else if (!userInfo.is_email_verified) {
        return res.send({ success: 0, message: message.emailNotVerified });
      }

      let token = await generateResetPasswordToken(req.body.email);

      await sendResetPasswordEmail(token, req.body.email, userInfo.name)

      // await CompanyUser.update({
      //   reset_password_token: token
      // }, {
      //   where: {
      //     id: userInfo.id
      //   }
      // });

      return res.send({ success: 1, message: "Password Reset Link has been shared on registered email address." })

    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.toString(), });
    }
  },
  saveNewPassword: async (req, res) => {
    try {
      let validator = new v(req.body, {
        token: "required",
        password: "required"
      });

      let matched = await validator.check();

      if (!matched) {
        console.log(validator.errors);
        return res
          .status(422)
          .send({
            success: 0,
            message: validator.errors[Object.keys(validator.errors)[0]].message
          });
      }

      let decodedToken = await JWT.verify(req.body.token, global.config.jwt.resetPassword.privateKey);

      if (!decodedToken || !decodedToken.email)
        return res.send({ success: 0, message: "Session is invalid!" })

      let userInfo = await CompanyUser.findOne({
        where: {
          email: decodedToken.email,
          // is_deleted: false,
          // status: true
        },
        attributes: ['id', 'is_email_verified'],
        raw: true
      });

      if (!userInfo) {
        return res.send({ success: 0, message: "Session is invalid!" });
      }
      else if (!userInfo.is_email_verified) {
        return res.send({ success: 0, message: "Email address is not verified!" });
      }
      // else if (userInfo.reset_password_token != req.body.token){
      //   return res.send({ success: 0, message: "This is an old reset link. Please check email for latest link to reset your password." });
      // }

      // let str = passwordStrength(req.body.password).value;
      // if (str != "Strong") {
      //   return res.status(200).send({ success: 0, message: "Weak Password" });
      // }
      // console.log("body -> ", req.body);
      // const salt = await bcrypt.genSalt(saltRounds);
      // const password = await bcrypt.hash(req.body.password, salt);

      let newSR = CONSTANT.saltRound[Math.floor(Math.random() * CONSTANT.saltRound.length)];

      const salt = await bcrypt.genSalt(newSR);
      const password = await bcrypt.hash(req.body.password, salt);

      await CompanyUser.update({
        password: password,
        jwt_token: null,
        // mapping_jwt_token: null,
        // tt_jwt: null,
        // email_verification_token: null,
        // reset_password_token: null,
        // sap_jwt_token: null
      }, {
        where: {
          id: userInfo.id
        }
      });

      return res.send({ success: 1, message: "Password has changed successfully!" });
    } catch (error) {
      console.log(error)
      if (error.name == 'JsonWebTokenError' || error.name == 'TokenExpiredError') {
        return res.send({ success: 0, message: error.name == 'JsonWebTokenError' ? "Reset password failed please try again!" : "This Link has Expired. Please generate a request for a new reset link" });
      } else {
        logger.error(req, error.message);
        return res.status(500).send({ success: 0, message: "Opps! Something went wrong!" });
      }
    }
  },
};

async function getStateAndCityId(pincode) {
  // one problem 
  // many cities may associated with same pincode 

  const pincodeInfo = await Pincodes.findOne({
    where: {
      pincode: pincode,
    },
    raw: true
  });
  if (pincodeInfo) {
    return pincodeInfo;
  }
  else {
    console.log("Invaild Pincode");
    return 0;
  }
}
function AddMinutesToDate(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

// Function to encode the object
async function encode(string) {
  let key = password_derive_bytes(password, '', 100, 32);
  // Initialize Cipher Object to encrypt using AES-256 Algorithm 
  let cipher = crypto.createCipheriv('aes-256-cbc', key, ivstring);
  let part1 = cipher.update(string, 'utf8');
  let part2 = cipher.final();
  const encrypted = Buffer.concat([part1, part2]).toString('base64');
  return encrypted;
}

// Function to decode the object
async function decode(string) {
  let key = password_derive_bytes(password, '', 100, 32);
  // Initialize decipher Object to decrypt using AES-256 Algorithm
  let decipher = crypto.createDecipheriv('aes-256-cbc', key, ivstring);
  let decrypted = decipher.update(string, 'base64', 'utf8');
  decrypted += decipher.final();
  return decrypted;
}

function password_derive_bytes(password, salt, iterations, len) {
  let key = Buffer.from(password + salt);
  for (let i = 0; i < iterations; i++) {
    key = sha1(key);
  }
  if (key.length < len) {
    let hx = password_derive_bytes(password, salt, iterations - 1, 20);
    for (let counter = 1; key.length < len; ++counter) {
      key = Buffer.concat([key, sha1(Buffer.concat([Buffer.from(counter.toString()), hx]))]);
    }
  }
  return Buffer.alloc(len, key);
}

// Function to find SHA1 Hash of password key
function sha1(input) {
  return crypto.createHash('sha1').update(input).digest();
}

function compareDates(a, b) {
  // Compare two dates (could be of any type supported by the convert
  // function above) and returns:
  //  -1 : if a < b
  //   0 : if a = b
  //   1 : if a > b
  // NaN : if a or b is an illegal date
  return (
    isFinite(a = convert(a).valueOf()) &&
      isFinite(b = convert(b).valueOf()) ?
      (a > b) - (a < b) :
      NaN
  );
}


function convert(d) {
  // Converts the date in d to a date-object. The input can be:
  //   a date object: returned without modification
  //  an array      : Interpreted as [year,month,day]. NOTE: month is 0-11.
  //   a number     : Interpreted as number of milliseconds
  //                  since 1 Jan 1970 (a timestamp) 
  //   a string     : Any format supported by the javascript engine, like
  //                  "YYYY/MM/DD", "MM/DD/YYYY", "Jan 31 2009" etc.
  //  an object     : Interpreted as an object with year, month and date
  //                  attributes.  **NOTE** month is 0-11.
  return (
    d.constructor === Date ? d :
      d.constructor === Array ? new Date(d[0], d[1], d[2]) :
        d.constructor === Number ? new Date(d) :
          d.constructor === String ? new Date(d) :
            typeof d === "object" ? new Date(d.year, d.month, d.date) :
              NaN
  );
}

async function getUIDAndLevel(code) {
  let UID, level;
  let dynamicCode = code[2] + code[6] + code[8];
  let dynamicUID = await DynamicUIDModel.findOne({
    where: {
      code: dynamicCode
    },
    raw: true
  })

  if (!dynamicUID) {
    console.log("-------------Dynamic UID Not Found");
  } else {
    UID = dynamicUID.u_id
  }

  let dynamicLevel = await DynamicLevelCodesModel.findOne({
    where: {
      code: code[4],
      level: {
        [Op.ne]: null
      }
    },
    raw: true
  })
  console.log("dyanmic Level::", code[4], dynamicLevel);
  if (!dynamicLevel) {
    console.log("-------------,Level Not Found");
  } else {
    level = dynamicLevel.level
  }
  console.log(">>>>>>>>?data?????>", level, "?????", UID);

  return {
    UID: UID,
    level: level
  }
}

async function getUIDLevelAndCode(code) {
  let obj;
  if (code.includes('ttags.in')) {
    let splitted = code.split('/');
    if (splitted.length > 0) {
      obj = {
        level: splitted[1][5], // AM1AAP
        uniqueCode: splitted[1],
        UID: splitted[1].substring(2, 5),
      }
    }
  } else {
    level = code[5].toUpperCase();
    if (['P', 'S', 'T', 'O'].includes(level)) {
      obj = {
        level: level, // AM1AAP
        uniqueCode: code,
        UID: code.substring(2, 5),
      }
    }
  }
  return obj;
}

async function getDynamicModel(key, UID) {
  try {
    console.log("-------key", key);
    console.log(">>>>>u>", UID);
    let CustomModel;
    switch (key) {
      case 'P':
        CustomModel = await DynamicModels.getPrimaryQRCodesModel(UID.toLowerCase());
        break;
      case 'S':
        CustomModel = await DynamicModels.getSecondaryQRCodesModel(UID.toLowerCase());
        break;
      case 'T':
        CustomModel = await DynamicModels.getTertiaryQRCodesModel(UID.toLowerCase());
        break;
      case 'O':
        CustomModel = await DynamicModels.getOuterQRCodesModel(UID.toLowerCase());
        break;
      default:
        console.log("---Invalid Level----", new Date());
        break;
    }
    return CustomModel;
  } catch (error) {
    console.log(error);
  }
}

async function parentLvl(codeLevel, masterInfo) {
  let outerLevel = null;
  if (codeLevel == 'P') {
    if (masterInfo.is_mapp_secondary) {
      outerLevel = 'S';
    }
    else if (masterInfo.is_mapp_tertiary) {
      outerLevel = 'T';
    }
    else {
      outerLevel = 'O';
    }
  }
  else if (codeLevel == 'S') {
    if (masterInfo.is_mapp_tertiary) {
      outerLevel = 'T';
    }
    else {
      outerLevel = 'O';
    }
  }
  else if (codeLevel == 'T') {
    outerLevel = 'O';
  }
  else if (codeLevel == 'O') {
    outerLevel = null;
  }
  return outerLevel;
};

const createJWT = async (userId, locationId, deviceId) => {
  try {
    const token = await JWT.sign({ userId, locationId, deviceId },
      global.config.jwt.trustTrack.privateKey, {
      algorithm: global.config.jwt.trustTrack.alg,
      expiresIn: global.config.jwt.trustTrack.expIn
    });

    return token;
  } catch (error) {
    console.log(error);
    return false
  }

}
async function generateEmailVerificationToken(email) {
  return await JWT.sign({
    email: email
  },
    global.config.jwt.emaiVerification.privateKey,
    {
      algorithm: global.config.jwt.emaiVerification.alg,
      expiresIn: global.config.jwt.emaiVerification.expIn
    })
}
async function generateResetPasswordToken(email) {
  return await JWT.sign(
    { email: email },
    global.config.jwt.resetPassword.privateKey,
    {
      algorithm: global.config.jwt.resetPassword.alg,
      expiresIn: global.config.jwt.resetPassword.expIn
    }
  )
}
async function sendEmailVerificationMail(token, email) {
  console.log("tokennnnnn.........................", token)
  EJS.renderFile("./templates/email/email-verification.ejs", {
    value: {
      url: `${process.env.SITEURL}user-email-verification?token=${token}`,
      email: email,
    }
  },
    function (err, result) {
      sendMail({
        to_email: email,
        subject: "Trusttags - Email Verification",
        email_content: result
      });
    }
  );
}

async function sendResetPasswordEmail(token, email, name) {
  console.log("process.env.AdminPanelURL", process.env.AdminPanelURL);
  EJS.renderFile(
    "./templates/email/reset-password-link.ejs",
    {
      value: {
        url: `${process.env.AdminPanelURL}user-reset-password?token=${token}`,
        name: name
      }
    },
    function (err, result) {
      sendMail({
        to_email: email,
        subject: "Trusttags - Reset Password",
        email_content: result
      });
    }
  );
}

module.exports = loginController;
