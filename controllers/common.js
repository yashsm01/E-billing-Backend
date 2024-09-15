const v = require("node-input-validator");
const Sequelize = require('sequelize');
let Op = Sequelize.Op;
const JWT = require("jsonwebtoken");
const EJS = require("ejs");
const { sendMail } = require("../helpers/mail");

const axios = require('axios');
const otpGenerator = require('otp-generator');
const bcrypt = require("bcryptjs");
const message = require('../i18n/en');
const logger = require('../helpers/logger');
const parseValidate = require('../middleware/parseValidate');

const country = require('../models').countries;
const states = require('../models').state;
const cities = require('../models').city;
const companyRoles = require("../models").company_roles;
const UOMModel = require("../models").uom;
const CustomerCareModel = require('../models').customer_care;
const StockSummary = require('../models').stock_summary;
const PwaVersions = require('../models').pwa_versions;
const uuid = require('uuid')
const DynamicUIDModel = require("./../models/").dynamic_uids;
const XCompanyCodes = require('./../models/').x_company_codes;
const DynamicLevelCodesModel = require('./../models/').dynamic_level_codes;

//models
const models = require("./_models");

//controllers
const qrCodeController = require("./qr-codes-controller");

const commonController = {
  //get email verification token
  generateEmailVerificationToken: async (email) => {
    return await JWT.sign({
      email: email
    },
      global.config.jwt.emaiVerification.privateKey,
      {
        algorithm: global.config.jwt.emaiVerification.alg,
        expiresIn: global.config.jwt.emaiVerification.expIn
      })
  },
  //send email To verify mail
  sendEmailVerificationMail: async (token, email) => {
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
  },
  //e-billing Controllers
  s3AddImage: async (file, imgId, pathName) => {
    if (!file) {
      return { success: 0, message: "No Image Available" };
    }
    if (!ValidateFileType(file)) {
      return { success: 0, message: "Invalid Image" };
    }
    const fileExtension = path.extname(file.name);
    const fileName = imgId + fileExtension
    //----------AWS s3 Image upload------
    let params = {
      Bucket: `${global.config.storage.name}/${pathName}`,
      Key: fileName,
      Body: file.data,
    }
    let response = await global.s3.upload(params).promise();
    let imageURL = response.Location;
    return { success: 1, data: imageURL, message: "Image Added" };
  },
  addOrUpdateProductStockSummary: async (schema, retailerId, retailOutletId, element, tableUid) => {
    try {
      let exist = await schema.findOne({
        where: {
          retailer_id: retailerId,
          retail_outlet_id: retailOutletId,
          product_id: element.product_id
        },
        raw: true
      });
      if (exist) {
        await schema.update({
          qty: Number(exist.qty ?? 0) + Number(element.qty),
          unit_qty: Number(exist.unit_qty) + Number(element.unit_qty),
          free_product: Number(element.free_product),
        }, {
          where: {
            id: exist.id,
            retailer_id: retailerId,
            retail_outlet_id: retailOutletId,
            product_id: element.product_id,
          }
        })
      }
      else {
        let getCode = await commonController.getEncodeQrCodes(tableUid);
        await schema.create({
          id: uuid(),
          retailer_id: retailerId,
          retail_outlet_id: retailOutletId,
          product_id: element.product_id,
          qty: element.qty,
          unit_qty: element.unit_qty,
          // unit_qty: "",
          qr_code: `${getCode}`,
          // serial_code: `${serialCode.data[0]}`
        })
      }
    } catch (error) {
      console.log(error);
    }
  },
  addOrUpdateBatchStockSummary: async (schema, retailerId, retailOutletId, element, tableUid) => {
    try {
      let exist = await schema.findOne({
        where: {
          retailer_id: retailerId,
          retail_outlet_id: retailOutletId,
          product_id: element.product_id,
          batch_id: element.batch_id,
        },
        raw: true
      });
      if (exist) {
        await schema.update({
          qty: Number(exist.qty) + Number(element.qty),
          unit_qty: Number(exist.unit_qty) + Number(element.unit_qty),
          free_product: Number(element.free),
        }, {
          where: {
            id: exist.id,
            retailer_id: retailerId,
            retail_outlet_id: retailOutletId,
            product_id: element.product_id,
            batch_id: element.batch_id
          }
        })
      }
      else {
        let getCode = await commonController.getEncodeQrCodes(tableUid);
        await schema.create({
          id: uuid(),
          retailer_id: retailerId,
          retail_outlet_id: retailOutletId,
          product_id: element.product_id,
          batch_id: element.batch_id,
          qty: element.qty,
          unit_qty: element.unit_qty,
          qr_code: `${getCode}`
        })
      }
    } catch (error) {
      console.log(error);
      // return res.status(500).send({ message: error.toString() });
    }
  },
  addOrUpdateretailDistributorPayment: async (schema, retailerId, retailOutletId, element, tableUid) => {
    try {
      let exist = await schema.findOne({
        where: {
          retailer_id: retailerId,
          retail_outlet_id: retailOutletId,
          distributor_id: element.distributor_id
        },
        raw: true
      });
      if (exist) {
        await schema.update({
          payment_amount: Number(exist.payment_amount) + Number(element.payment_amount),
          pending_amount: Number(exist.pending_amount) + Number(element.payment_amount) * element.action,
          order_count: Number(exist.order_count) + element.order_count,
          pending_count: Number(exist.pending_count) + element.action
        }, {
          where: {
            id: exist.id,
            retailer_id: retailerId,
            retail_outlet_id: retailOutletId,
            distributor_id: element.distributor_id
          }
        })
      }
      else {
        await schema.create({
          id: uuid(),
          retailer_id: retailerId,
          retail_outlet_id: retailOutletId,
          distributor_id: element.distributor_id,
          payment_amount: Number(element.payment_amount),
          pending_amount: Number(element.payment_amount) * element.action,
          order_count: 1,
          pending_count: element.action
        })
      }
    } catch (error) {
      console.log(error);
      // return res.status(500).send({ message: error.toString() });
    }
  },
  addOrUpdateretailCustomerPayment: async (schema, retailerId, retailOutletId, element, tableUid) => {
    try {
      let exist = await schema.findOne({
        where: {
          retailer_id: retailerId,
          retail_outlet_id: retailOutletId,
          consumer_id: element.consumer_id
        },
        raw: true
      });
      if (exist) {
        await schema.update({
          payment_amount: Number(exist.payment_amount) + Number(element.payment_amount),
          pending_amount: Number(exist.pending_amount) + Number(element.payment_amount) * element.action,
          order_count: Number(exist.order_count) + element.order_count,
          pending_count: Number(exist.pending_count) + element.action
        }, {
          where: {
            id: exist.id,
            retailer_id: retailerId,
            retail_outlet_id: retailOutletId,
            consumer_id: element.consumer_id
          }
        })
      }
      else {
        await schema.create({
          id: uuid(),
          retailer_id: retailerId,
          retail_outlet_id: retailOutletId,
          consumer_id: element.consumer_id,
          payment_amount: Number(element.payment_amount),
          pending_amount: Number(element.payment_amount) * element.action,
          order_count: 1,
          pending_count: element.action
        })
      }
    } catch (error) {
      console.log(error);
      // return res.status(500).send({ message: error.toString() });
    }
  },
  //Payment return updates
  addOrUpdateRetailDistributorReturnPayment: async (schema, retailerId, retailOutletId, element, tableUid) => {
    try {
      let exist = await schema.findOne({
        where: {
          retailer_id: retailerId,
          retail_outlet_id: retailOutletId,
          distributor_id: element.distributor_id
        },
        raw: true
      });
      if (exist) {
        await schema.update({
          return_payment_amount: Number(exist.return_payment_amount) + Number(element.payment_amount),
          return_pending_amount: Number(exist.return_pending_amount) + Number(element.payment_amount) * element.action,
          order_return_count: Number(exist.order_return_count) + element.order_count,
          return_pending_count: Number(exist.return_pending_count) + element.action
        }, {
          where: {
            id: exist.id,
            retailer_id: retailerId,
            retail_outlet_id: retailOutletId,
            distributor_id: element.distributor_id
          }
        })
      }
      else {
        await schema.create({
          id: uuid(),
          retailer_id: retailerId,
          retail_outlet_id: retailOutletId,
          distributor_id: element.distributor_id,
          return_payment_amount: Number(element.payment_amount),
          return_pending_amount: Number(element.payment_amount) * element.action,
          order_return_count: 1,
          return_pending_count: element.action
        })
      }
    } catch (error) {
      console.log(error);
      // return res.status(500).send({ message: error.toString() });
    }
  },
  addOrUpdateRetailCustomerReturnPayment: async (schema, retailerId, retailOutletId, element, tableUid) => {
    try {
      let exist = await schema.findOne({
        where: {
          retailer_id: retailerId,
          retail_outlet_id: retailOutletId,
          consumer_id: element.consumer_id
        },
        raw: true
      });
      if (exist) {
        await schema.update({
          return_payment_amount: Number(exist.return_payment_amount) + Number(element.payment_amount),
          return_pending_amount: Number(exist.return_pending_amount) + Number(element.payment_amount) * element.action,
          order_return_count: Number(exist.order_return_count) + element.order_count,
          return_pending_count: Number(exist.return_pending_count) + element.action
        }, {
          where: {
            id: exist.id,
            retailer_id: retailerId,
            retail_outlet_id: retailOutletId,
            consumer_id: element.consumer_id
          }
        })
      }
      else {
        await schema.create({
          id: uuid(),
          retailer_id: retailerId,
          retail_outlet_id: retailOutletId,
          consumer_id: element.consumer_id,
          return_payment_amount: Number(element.payment_amount),
          return_pending_amount: Number(element.payment_amount) * element.action,
          order_return_count: 1,
          return_pending_count: element.action
        })
      }
    } catch (error) {
      console.log(error);
      // return res.status(500).send({ message: error.toString() });
    }
  },
  getEncodeQrCodes: async (TU) => {
    let response = await qrCodeController.getQrCodes(1);
    let SC = response.data[0];
    let code = SC[0] + TU[0] + SC[1] + TU[1] + SC[2] + TU[3] + SC[3] + TU[4] + SC[4] + SC[5] + TU[5] + TU[6] + SC[6];
    // TUID = 1 3 5 7 10 11 
    // code = 0 2 4 6 8 9 12 
    return code;
  },
  getDecodeQrCodes: async (SC) => {
    let qrCode = SC;
    let TUID = SC[1] + SC[3] + "_" + SC[5] + SC[7] + SC[10] + SC[11];
    let code = SC[0] + SC[2] + SC[4] + SC[6] + SC[8] + SC[9] + SC[12];
    // TUID = 1 3 5 7 10 11 
    // code = 0 2 4 6 8 9 12 
    return { TUID, code, qrCode };
  },
  //============================================================================
  pwaVersionAdd: async (req, res) => {
    try {
      let validator = new v(req.body, {
        name: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      const isExist = await PwaVersions.count({
        where: {
          //name: req.body.name,
          name: { [Op.iLike]: req.body.name }
        },
      });

      if (isExist > 0) {
        return res.status(200).send({
          success: 0,
          message: `Version is already Exist!`,
        });
      }

      let versionId = uuid();
      await PwaVersions.create({
        id: versionId,
        name: req.body.name,
        status: true,
        is_deleted: false
      })

      // is Updated Consumers
      await models.Consumers.update({
        is_updated_version: false
      }, {
        where: {
          // is_updated_version: false
        }
      });

      //is Updated CP
      const isUpdatedCP = await models.ChannelPartners.update({
        is_updated_version: false
      }, {
        where: {
          // is_updated_version: false
        }
      });

      // if (isUpdated < 1) {
      //   return res
      //     .status(200)
      //     .send({
      //       success: 0,
      //       message: "User not updated"
      //     });

      return res.status(200).send({
        success: 1,
        message: "Version added successfully.",
        data: "Added"
      });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },

  getPwaVersionsList: async (req, res) => {
    try {
      let details = await PwaVersions.findAll({});

      return res.send({ success: 1, data: details });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },
  getCustomerCareDetailsOpen: async (req, res) => {
    try {
      let details = await CustomerCareModel.findAll({});

      return res.send({ success: 1, data: details });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },
  pwaLatestVersion: async (req, res) => {
    try {
      let details = await PwaVersions.findOne({ order: [['createdAt', 'DESC']], });
      return res.send({ success: 1, data: details });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },
  country: async function (req, res) {
    try {
      let countries = await country.findAll();

      return res.status(200).send({ "success": '1', "data": countries });
    } catch (ex) {
      logger.error(req, ex.message);
      return res.status(200).send({ success: 0, message: ex.message });
    }
  },

  stateList: async function (req, res) {
    try {
      console.log("statelist found>>>>>>>>");
      let stateList = await states.findAll({
        where: {
          country_id: req.params.countryId
        },
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'country_id'],
        raw: true
      });
      console.log("all states>>>>>", stateList);
      return res.status(200).send({ "success": '1', "data": stateList });
    } catch (ex) {
      logger.error(req, ex.message);
      return res.status(500).send({ success: 0, message: ex.message });
    }
  },

  districtList: async function (req, res) {
    try {
      let districtList = await models.districtModel.findAll({
        where: {
          state_id: req.params.stateId
        },
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'state_id'],
        raw: true
      });
      return res.status(200).send({ "success": '1', "data": districtList });
    } catch (ex) {
      logger.error(req, ex.message);
      return res.status(500).send({ success: 0, message: ex.message });
    }
  },

  talukaList: async function (req, res) {
    try {
      let talukaList = await models.taluksModel.findAll({
        where: {
          district_id: req.params.districtId
        },
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'district_id'],
        raw: true
      });
      return res.status(200).send({ "success": '1', "data": talukaList });
    } catch (ex) {
      logger.error(req, ex.message);
      return res.status(500).send({ success: 0, message: ex.message });
    }
  },

  citiesList: async function (req, res) {
    try {
      let citiesList = await models.cityModel.findAll({
        where: {
          taluks_id: req.params.talukaId
        },
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'taluks_id'],
        raw: true
      });
      return res.status(200).send({ "success": '1', "data": citiesList });
    } catch (ex) {
      logger.error(req, ex.message);
      return res.status(500).send({ success: 0, message: ex.message });
    }
  },

  cityListByDistrictId: async function (req, res) {
    try {
      console.log("citylist>>>>>>>")
      let cityList = await cities.findAll({
        where: {
          district_id: req.params.districtId
        },
        attributes: ['id', 'name', 'state_id'],
        raw: true,
        order: [['name', 'ASC']]
      });
      console.log("city lists>>>>", cityList)
      return res.status(200).send({ "success": '1', "data": cityList });
    } catch (ex) {
      logger.error(req, ex.message);
      console.error(ex);
      return res.status(500).send({ success: 0, message: ex.message });
    }
  },

  citylist: async function (req, res) {
    try {
      console.log("citylist>>>>>>>")
      let ListCity = await cities.findAll({
        where: {
          state_id: req.params.stateId
        },
        attributes: ['id', 'name', 'state_id'],
        raw: true,
        order: [['name', 'ASC']]
      });
      console.log("city lists>>>>", ListCity)
      return res.status(200).send({ "success": '1', "data": ListCity });
    } catch (ex) {
      logger.error(req, ex.message);
      console.error(ex);
      return res.status(500).send({ success: 0, message: ex.message });
    }
  },

  getMultiTerritoryList: async function (req, res) {
    try {

      let whereClause = {};
      let regionIds = [];
      if (req.body.regions.length > 0) {
        regionIds = req.body.regions.map(x => x.item_id);
        whereClause.region_id = { [Op.in]: regionIds };
      }

      let territoryList = await models.territoryMasterModel.findAll({
        where: whereClause,
        order: [['unique_id', 'ASC']],
        raw: true
      });

      return res.status(200).send({ success: 1, message: 'success', data: territoryList });
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  pincodeByCityId: async function (req, res) {
    try {
      console.log("hit")
      let pincodeInfo = await models.pincodeModel.findOne({
        where: {
          city_id: req.query.cityId
        },
        attributes: ['pincode'],
        raw: true,
      });
      console.log("pincodeInfo lists>>>>", pincodeInfo)
      return res.status(200).send({ "success": '1', "data": pincodeInfo });
    } catch (ex) {
      logger.error(req, ex.message);
      console.error(ex);
      return res.status(500).send({ success: 0, message: ex.message });
    }
  },

  //Get Selection Of Multi Country/State/distric
  getMultiStateList: async function (req, res) {
    try {
      let validator = new v(req.body, {
        countryIds: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      let countryIds = req.body.countryIds.map(x => x.id);
      let stateList = await models.stateModel.findAll({
        where: {
          country_id: { [Op.in]: countryIds }
        },
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'country_id'],
        raw: true
      });
      return res.status(200).send({ "success": '1', "data": stateList });

    } catch (ex) {
      logger.error(req, ex.message);
      console.error(ex);
      return res.status(500).send({ success: 0, message: ex.message });
    }
  },
  getMultiDistrictList: async function (req, res) {
    try {
      let validator = new v(req.body, {
        // stateIds: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      let stateIds = req.body.stateIds.map(x => x.id);
      let ListDistrict = await models.districtModel.findAll({
        where: {
          state_id: { [Op.in]: stateIds },
          // is_allocated: false
        },
        attributes: ['id', 'name', 'state_id'],
        raw: true,
        order: [['name', 'ASC']]
      });
      let list = [];
      if (stateIds.length > 1) {
        for (let index = 0; index < req.body.stateIds.length; index++) {
          const element = req.body.stateIds[index];
          let filterData = ListDistrict.filter(x => {
            if (x.state_id == element.id) {
              return { ...x, state: false }
            }
          });
          list.push({
            district: filterData, states: { ...element, state: false }
          });
        }
      }
      else {
        list.push({ district: ListDistrict.map(x => { return { ...x, state: false } }), states: { ...req.body.stateIds[0], state: false } });
      }
      return res.status(200).send({ "success": '1', "data": list });
    } catch (ex) {
      logger.error(req, ex.message);
      console.error(ex);
      return res.status(500).send({ success: 0, message: ex.message });
    }
  },

  getCustomerCareDetails: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: "required"
      });

      let matched = await validator.check();

      if (!matched) {
        return res
          .status(200)
          .send({ success: "0", message: validator.errors });
      }
      let details = await CustomerCareModel.findOne({
        where: {
          id: req.query.id,
          is_deleted: false
        }
      });

      return res.send({ success: 1, data: details });
    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },
  getCustomerCareList: async (req, res) => {
    try {
      let details = await CustomerCareModel.findAll({
        where: {
          is_deleted: false
        },
        order: [
          ["createdAt", "DESC"]
        ],
      });

      return res.send({ success: 1, data: details });
    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },
  addCustomerCareDetails: async (req, res) => {
    try {
      let validator = new v(req.body, {
        marketedBy: "required",
        email: "required",
        phoneNo: "required",
        address: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: "0", message: validator.errors });
      }
      if (req.body.serializeDigit > 18) {
        return res.status(200).send({ success: "0", message: "Serialize Digit  Should Not Br Greater Then 18" });
      }
      if (req.body.codePrefix.length > 3) {
        return res.status(200).send({ success: "0", message: "code Prefix Length Should Not Br Greater Then 3" });
      }


      await CustomerCareModel.create({
        id: uuid.v4(),
        marketed_by: req.body.marketedBy,
        email: req.body.email,
        phone_no: req.body.phoneNo,
        address: req.body.address,
        url: req.body.url ? req.body.url : null,
        code_prefix: req.body.codePrefix ? req.body.codePrefix : null,
        serialize_digit: req.body.serializeDigit ? req.body.serializeDigit : 0,
        serialize_status: req.body.serializeStatus ? req.body.serializeStatus : false,
        manual_po_status: req.body.manualPoStatus ? req.body.manualPoStatus : false,
        facebook_link: req.body?.fgLink,
        instagram_link: req.body?.instaLink,
        twitter_link: req.body?.twitterLink,
        linkedin_link: req.body?.linkedInLink,
        youtube_link: req.body?.youTubeLink,
        company_url: req.body?.companyURL,
        is_3p: req.body.is3P ? req.body.is3P : false,
        is_3p_logo: req.body.is3pLogo ? req.body.is3pLogo : false,
        esign_status: 2,
      });
      return res.status(200).send({ success: 1, message: "Successfully Added" });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },
  updateCustomerCareDetails: async (req, res) => {
    try {
      let validator = new v(req.body, {
        marketedBy: "required",
        email: "required",
        phoneNo: "required",
        address: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: "0", message: validator.errors });
      }

      await CustomerCareModel.update({
        marketed_by: req.body.marketedBy,
        email: req.body.email,
        phone_no: req.body.phoneNo,
        address: req.body.address,
        esign_status: 2,
        facebook_link: req.body?.fgLink,
        instagram_link: req.body?.instaLink,
        twitter_link: req.body?.twitterLink,
        linkedin_link: req.body?.linkedInLink,
        youtube_link: req.body?.youTubeLink,
        company_url: req.body?.companyURL
      }, {
        where: {
          id: req.params.id
        }
      });

      return res.send({ success: 1, message: "Successfully Updated" });
    } catch (error) {
      logger.error(req, error.message);
      console.log("EE", error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },
  companyRolesList: async (req, res) => {
    try {
      let whereClause = { is_deleted: false };
      if (req.roleId == 2) {
        whereClause.id = 3;
      }
      let roles = await companyRoles.findAll({
        where: whereClause,
        attributes: ['id', 'name'],
        order: [['id', 'ASC']]
      });

      let data = []
      roles.forEach(element => {
        if (element.id >= req.roleId) {
          data.push(element)
        }
      });
      return res.status(200).send({ success: '1', data: data })
    }
    catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message });
    }
  },
  GetEpoch: function () {
    const date = Math.floor(Date.now() / 1000);
    return date;
  },

  getUOMList: async (req, res) => {
    try {
      let data = await UOMModel.findAll({
        where: {},
        raw: true
      });
      console.log(">>>>>>>>>>>>>>>>>>>UOM List ", data);
      return res.status(200).send({ success: '1', data: data })
    }
    catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message });
    }
  },

  calculateMRP: async (masterInfo, caseMRP) => {

    let pMRP = 0, sMRP = 0, tMRP = 0, oMRP = caseMRP / 1;

    if (masterInfo.packaging_type != 1) {
      if (masterInfo.is_tertiary) {  // PSTO
        if (masterInfo.is_secondary) {
          // Tertiary MRP
          tMRP = caseMRP / Number(masterInfo.outer_size);
          //Secondary MRP:
          sMRP = tMRP / Number(masterInfo.tertiary_size);
          // Primary MRP
          pMRP = sMRP / Number(masterInfo.secondary_size);
        }
      }
      else if (masterInfo.is_secondary) {
        if (!masterInfo.is_tertiary) {
          //Secondary MRP:
          sMRP = caseMRP / Number(masterInfo.outer_size);
          // Primary MRP
          pMRP = sMRP / Number(masterInfo.secondary_size);
        }
      }
      else if (!masterInfo.is_secondary && !masterInfo.is_tertiary) {
        // Primary MRP
        pMRP = caseMRP / Number(masterInfo.outer_size);
      }
    }
    return {
      pMRP: Number(Math.round((Number(pMRP) + Number.EPSILON) * 100) / 100).toFixed(2),
      sMRP: Number(Math.round((Number(sMRP) + Number.EPSILON) * 100) / 100).toFixed(2),
      tMRP: Number(Math.round((Number(tMRP) + Number.EPSILON) * 100) / 100).toFixed(2),
      oMRP: Number(Math.round((Number(oMRP) + Number.EPSILON) * 100) / 100).toFixed(2)
    }

  },

  threeDecimal(number) {
    console.log("Number>>>>>>>>>>>>>", number);
    number = Number(number).toFixed(3);
    return number;
  },
  calculateCaseMRP: async (masterInfo, level, mrp) => {
    let caseMRP = false;
    mrp = Number(mrp).toFixed(2)
    let OS = Number(masterInfo.outer_size);
    let TS = Number(masterInfo.tertiary_size);
    let SS = Number(masterInfo.secondary_size);


    if (masterInfo.packaging_type != 1) {
      if (masterInfo.is_tertiary) {  // PSTO
        if (masterInfo.is_secondary) {

          if (level == 'P') {
            caseMRP = mrp * SS * TS * OS
          }
          else if (level == 'S') {
            caseMRP = mrp * TS * OS
          }
          else if (level == 'T') {
            caseMRP = mrp * OS
          }
        }
      }
      else if (masterInfo.is_secondary) {
        if (!masterInfo.is_tertiary) {

          if (level == 'P') {
            caseMRP = mrp * SS * OS
          }
          else if (level == 'S') {
            caseMRP = mrp * OS
          }

        }
      }
      else if (!masterInfo.is_secondary && !masterInfo.is_tertiary) {
        if (level == 'P') {
          caseMRP = mrp * OS
        }
      }
    }
    if (level == 'O') {
      caseMRP = mrp
    }
    return (caseMRP ? Number(Math.round((Number(caseMRP) + Number.EPSILON) * 100) / 100).toFixed(2) : false)
  },

  calculateMFactor: async (masterInfo) => {
    //let no of codes in per outer;
    let pCodes = 0, sCodes = 0, tCodes = 0;

    if (masterInfo.is_tertiary) {  // PSTO
      if (masterInfo.is_secondary) {
        // Tertiary Codes
        tCodes = 1 * Number(masterInfo.outer_size);
        //Secondary Codes:
        sCodes = 1 * Number(masterInfo.outer_size) * Number(masterInfo.tertiary_size);
        // Primary Codes
        pCodes = 1 * Number(masterInfo.outer_size) * Number(masterInfo.tertiary_size) * Number(masterInfo.secondary_size);
      }
    }
    else if (masterInfo.is_secondary) {
      if (!masterInfo.is_tertiary) {
        //Secondary Codes:
        sCodes = 1 * Number(masterInfo.outer_size);
        // Primary Codes
        pCodes = 1 * Number(masterInfo.outer_size) * Number(masterInfo.secondary_size);
      }
    }
    else if (!masterInfo.is_secondary && !masterInfo.is_tertiary) {
      // Primary Codes
      pCodes = 1 * Number(masterInfo.outer_size);
    }


    return {
      // pFactor: pCodes > 0 ? (1 / pCodes).toFixed(3) : null,  1/3   0.333   0.999
      // sFactor: sCodes > 0 ? (1 / sCodes).toFixed(3) : null,
      // tFactor: tCodes > 0 ? (1 / tCodes).toFixed(3) : null,
      // oFactor: 1
      pFactor: pCodes > 0 ? pCodes : 1,
      sFactor: sCodes > 0 ? sCodes : 1,
      tFactor: tCodes > 0 ? tCodes : 1,
      oFactor: 1
    }
  },
  addorUpdateSchemePoints: async (schemeId, schemeType, count, valuationId, currentValuation) => {
    let exists = await models.pointAllocationModel.findOne({
      where: {
        id: schemeId
      },
      raw: true,
    })
    if (exists) {
      await models.pointAllocationModel.update({
        redeemed_points: exists.redeemed_points + count,
      }, {
        where: {
          id: exists.id
        }
      })
    }
    return true;
  },
  addOrUpdateStockSummary: async (locationId, storageBin, productId, batchId, level, count) => {
    let exists = await StockSummary.findOne({
      where: {
        location_id: locationId,
        storage_bin: storageBin,
        product_id: productId,
        batch_id: batchId,
        packaging_level: level, // P,S,T,O,
      },
      raw: true,
    })
    if (exists) {
      await StockSummary.update({
        qty: exists.qty + count,
      }, {
        where: {
          id: exists.id
        }
      })
    } else {
      await StockSummary.create({
        id: uuid(),
        location_id: locationId,
        storage_bin: storageBin,
        product_id: productId,
        batch_id: batchId,
        packaging_level: level,
        qty: count,
      })
    }
    return true;
  },
  getUIDAndLevel: async (code) => {
    return await getUIDAndLevelNew(code)
  },

  getInnerLevel: async (masterInfo, level) => {
    try {
      let innerLevel;
      if (masterInfo.packaging_type == 2) {
        if (level == 'S') {
          if (masterInfo.is_mapp_primary) {
            innerLevel = 'P';
          }
        }

        else if (level == 'T') {
          if (masterInfo.is_mapp_secondary) {
            innerLevel = 'S';
          }
          else if (masterInfo.is_mapp_primary) {
            innerLevel = 'P'
          }
        }
        else if (level == 'O') {

          if (masterInfo.is_mapp_tertiary) {
            innerLevel = 'T';
          } else if (masterInfo.is_mapp_secondary) {
            innerLevel = 'S';
          } else if (masterInfo.is_mapp_primary) {
            innerLevel = 'P';
          }
        }
      }
      return innerLevel;

    } catch (error) {
      console.log(error);
      return false;
    }
  },

  getParentLevel: async (masterInfo, level) => {
    try {
      let parentLevel;
      if (level == 'O') {
        return false;   // No Parent
      }
      else {
        if (level == 'P') {
          if (masterInfo.is_mapp_secondary) {
            parentLevel = 'S';
          }
          else if (masterInfo.is_mapp_tertiary) {
            parentLevel = 'T';
          }
          else if (masterInfo.is_mapp_outer) {
            parentLevel = 'O';
          }
        }

        if (level == 'S') {
          if (masterInfo.is_mapp_tertiary) {
            parentLevel = 'T';
          }
          else if (masterInfo.is_mapp_outer) {
            parentLevel = 'O';
          }
        }

        else if (level == 'T') {
          if (masterInfo.is_mapp_outer) {
            parentLevel = 'O';
          }
        }
      }
      return parentLevel;

    } catch (error) {
      console.log(error);
      return false;
    }
  },
  getsplitUID: async (code) => {
    return await splitUID(code)
  },
  varifyDynamicCodes: async (code) => {
    try {
      let key;
      let uniqueCode;
      let UID;
      let level;
      let batch;
      let codeUrl = models.config.codeUrl.toLowerCase();
      if (code.length > 13 && code.toLowerCase().includes(codeUrl)) {
        code = code.replace('http://', '');
        code = code.replace('https://', '');
        code = code.replace('HTTP://', '');
        code = code.replace('HTTPS://', '');
        let split1 = code.split('/');
        let split2 = split1[6].split('?');
        batch = split1[4];
        let sku = split1[2];
        let values = await getUIDAndLevelNew(split2[0], null);
        UID = values.UID;
        level = values.level;
        key = values.level == 'P' ? 1 : values.level == 'S' ? 2 : values.level == 'O' ? 3 : 4;
        uniqueCode = split2[0];
      }
      else if (code.toLowerCase().includes(models.config.clientUrl.toLowerCase())) {
        code = code.replace('http://', '');
        code = code.replace('https://', '');
        code = code.replace('HTTP://', '');
        code = code.replace('HTTPS://', '');
        let split1 = code.split('/');
        let split2 = split1[6].split('?');
        uniqueCode = split2[0];
        let xCodeDetails = await XCompanyCodes.findOne({
          where: {
            unique_code: uniqueCode
          },
          raw: true
        })

        if (!xCodeDetails) {
          return false;
        }
        batch = split1[4];
        key = xCodeDetails.level == 'P' ? 1 : xCodeDetails.level == 'S' ? 2 : xCodeDetails.level == 'O' ? 3 : 4;
        UID = xCodeDetails.u_id;
        level = xCodeDetails.level
      }
      else if (code.length == 12) {
        uniqueCode = code;
        console.log("Unique Code::", uniqueCode);
        let xCodeDetails = await XCompanyCodes.findOne({
          where: {
            unique_code: uniqueCode
          },
          raw: true
        })

        if (!xCodeDetails) {
          return false;
        }

        UID = xCodeDetails.u_id;
        level = xCodeDetails.level
      }
      else {
        let values = await getUIDAndLevelNew(code, null);
        UID = values.UID;
        level = values.level;
        key = values.level == 'P' ? 1 : values.level == 'S' ? 2 : values.level == 'O' ? 3 : 4;
        uniqueCode = code;
      }

      return { key, uniqueCode, UID, level, batch }
    }
    catch (error) {
      return { key: null, uniqueCode: '' }
    }
  },
  esignUpdate: async (req, res) => {
    try {
      let validator = new v(req.body, {
        id: 'required',
        type: "required",
        status: "required",
        reason: "required",
        email: "required",
        password: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      if (![0, 17, 1].includes(req.roleId)) {
        return res.status(200).send({ success: 0, message: "Invalid User" });
      }

      let userDetail = await models.CompanyUserModel.findOne({
        where: {
          id: req.userId,
          email: req.body.email
        },
      });

      if (!userDetail) {
        return res.status(200).send({ success: 0, message: "Invalid Username Or Password" });
      }

      // let checkPass = await bcrypt.compare(req.body.password, userDetail.password);

      // if (!checkPass) {
      //   return res.status(200).send({ success: 0, message: "Invalid Username Or Password" });
      // }


      let type = {
        '1': 'Product',
        '2': 'Device',
        '3': 'Production Order',
        '4': 'Marketed By',
        '5': 'Point Allocation',
        '6': 'lucky draw'
      };
      console.log("Esign Update:>>>>>>", type[`${req.body.type}`]);
      let status = req.body.status;
      if (req.body.type == 1) {
        await models.productsModel.update({ otp: null, otp_duration: null, esign_status: status, reject_error: req.body.reason, approved_by: req.userId },
          {
            where: {
              id: req.body.id,
            }
          });
        return res.status(200).send({ success: 1, message: `Request ${status == 2 ? "Approved" : "Rejected"}` });
      };
      if (req.body.type == 5) {
        await models.pointAllocationModel.update({ otp: null, otp_duration: null, esign_status: status, reject_error: req.body.reason, approved_by: req.userId },
          {
            where: {
              id: req.body.id,
            }
          });
        return res.status(200).send({ success: 1, message: `Request ${status == 2 ? "Approved" : "Rejected"}` });
      };
      if (req.body.type == 6) {
        await models.LuckyDrawModel.update({ otp: null, otp_duration: null, esign_status: status, reject_error: req.body.reason, approved_by: req.userId },
          {
            where: {
              id: req.body.id,
            }
          });
        // here 
        //updateLDStatus -- Lucky Draw Status
        await commonController.updateLDStatus(req.body.id);
        return res.status(200).send({ success: 1, message: `Request ${status == 2 ? "Approved" : "Rejected"}` });
      };

      return res.status(200).send({ success: 0, message: "Request Failed " });
    } catch (ex) {
      console.error(ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
  sendOtp: async (req, res) => {
    try {
      let validator = new v(req.body, {
        id: 'required',
        // type: "required",
        // status: "required",
        reason: "required",
        email: "required",
        password: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      if (![0, 17, 1].includes(req.roleId)) {
        return res.status(200).send({ success: 0, message: "Invalid User" });
      }

      let userDetail = await models.CompanyUserModel.findOne({
        where: {
          id: req.userId,
          email: req.body.email
        },
      });

      if (!userDetail) {
        return res.status(200).send({ success: 0, message: "Invalid Username Or Password" });
      }

      let checkPass = await bcrypt.compare(req.body.password, userDetail.password);

      if (!checkPass) {
        return res.status(200).send({ success: 0, message: "Invalid Username Or Password" });
      }

      const otp = otpGenerator.generate(6, { digits: true, upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
      // const otp = 123456;

      const now = new Date();
      const expiration_time = AddMinutesToDate(now, 3);


      let otpConfig = global.config.otp;
      console.log("Config::", otpConfig.apikey);

      let response = await axios.get(`https://api.textlocal.in/send/?apikey=${global.config.otp.apiKey}=&numbers=${userDetail.mobile_no}&sender=${global.config.otp.sender}&custom=${global.config.otp.custom}&message=Your one time password is ${otp}. Kindly do not share it with anyone VIVIDE`);
      console.log("-------", response);
      console.log("-------", response.data.errors);
      if (response.data.status != 'success') {
        return res.status(200).send({ success: 0, message: "Some error in sending otp" })
      }

      if (req.body.type == 1) {
        await models.productsModel.update({ otp: otp, otp_duration: expiration_time },
          {
            where: {
              id: req.body.id,
            }
          });
        return res.status(200).send({ success: 1, message: `Otp has been sent on ${userDetail.mobile_no}` });
      };
      if (req.body.type == 5) {
        await models.pointAllocationModel.update({ otp: otp, otp_duration: expiration_time },
          {
            where: {
              id: req.body.id,
            }
          });
        return res.status(200).send({ success: 1, message: `Otp has been sent on ${userDetail.mobile_no}` });
      };
      if (req.body.type == 6) {
        await models.LuckyDrawModel.update({ otp: otp, otp_duration: expiration_time },
          {
            where: {
              id: req.body.id,
            }
          });
        return res.status(200).send({ success: 1, message: `Otp has been sent on ${userDetail.mobile_no}` });
      };

      return res.status(200).send({ success: 0, message: "Request Failed " });
    } catch (ex) {
      console.error(ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
  verifyOtp: async (req, res) => {
    try {
      let validator = new v(req.body, {
        id: 'required',
        // type: "required",
        // status: "required",
        reason: "required",
        otp: "required",
        email: "required",
        password: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      if (![0, 17, 1].includes(req.roleId)) {
        return res.status(200).send({ success: 0, message: "Invalid User" });
      }

      let userDetail = await models.CompanyUserModel.findOne({
        where: {
          id: req.userId,
          email: req.body.email
        },
      });

      if (!userDetail) {
        return res.status(200).send({ success: 0, message: "Invalid Username Or Password" });
      }

      // let checkPass = await bcrypt.compare(req.body.password, userDetail.password);

      // if (!checkPass) {
      //   return res.status(200).send({ success: 0, message: "Invalid Username Or Password" });
      // }
      if (req.body.type == 1) {
        let currentdate = new Date();
        let productDetail = await models.productsModel.findOne({
          where: {
            id: req.body.id,
            otp: req.body.otp,
            // otp_duration: { [Op.lte]: currentdate }
          }
        });
        if (!productDetail) {
          return res.status(200).send({ success: 0, message: "OTP Is Invalid" });
        }
        if (compareDates(productDetail.otp_duration, currentdate) != 1) {
          return res.status(200).send({ success: 0, message: "OTP Expired" });
        }

        return res.status(200).send({ success: 1, message: `Otp Verified` });
      };
      if (req.body.type == 5) {
        let currentdate = new Date();
        let pointscheme = await models.pointAllocationModel.findOne({
          where: {
            id: req.body.id,
            otp: req.body.otp,
            // otp_duration: { [Op.lte]: currentdate }
          }
        });
        if (!pointscheme) {
          return res.status(200).send({ success: 0, message: "OTP Is Invalid" });
        }
        if (compareDates(pointscheme.otp_duration, currentdate) != 1) {
          return res.status(200).send({ success: 0, message: "OTP Expired" });
        }

        return res.status(200).send({ success: 1, message: `Otp Verified` });
      };
      if (req.body.type == 6) {
        let currentdate = new Date();
        let luckyscheme = await models.LuckyDrawModel.findOne({
          where: {
            id: req.body.id,
            otp: req.body.otp,
            // otp_duration: { [Op.lte]: currentdate }
          }
        });
        if (!luckyscheme) {
          return res.status(200).send({ success: 0, message: "OTP Is Invalid" });
        }
        if (compareDates(luckyscheme.otp_duration, currentdate) != 1) {
          return res.status(200).send({ success: 0, message: "OTP Expired" });
        }

        return res.status(200).send({ success: 1, message: `Otp Verified` });
      };
      return res.status(200).send({ success: 0, message: "Request Failed " });
    } catch (ex) {
      console.error(ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
  updateLDStatus: async (LId) => {
    try {

      let luckyDrawForStart = await models.LuckyDrawModel.findOne({
        where: {
          id: LId,
          status: 0,
          esign_status: 2
        },
        raw: true
      })

      if (luckyDrawForStart) {
        let luckyDrawForStart = luckyDrawForStart.start_date;
        let executionTime = luckyDrawForStart.start_date;
        let cronExpression = await getCronExpression(executionTime);
        console.log("cronExpression>>>>>>>>>>>>", cronExpression);
        if (new Date(executionTime) < new Date()) {
          // skip this past lucky draw
          console.log("skip>>>>>>>>>>>>>>>>>>>", executionTime)
        }
        else {
          cron.schedule(cronExpression, () => {
            console.log(`Executing lucky draw start with 1: ${luckyDrawForStart.draw_name}`);
            // Write your luckyDraw execution logic here
            console.log(">>>>>>>>>YES I am Working", new Date());
            commonController.startLuckyDraw(LId);
          });
        }

        executionTime = luckyDrawForStart.end_date;
        cronExpression = await getCronExpression(executionTime);
        console.log("cronExpression>>>>>>>>>>>>", cronExpression);

        console.log("end LD comes");
        cron.schedule(cronExpression, () => {
          console.log(`Executing lucky draw end with 3: ${luckyDrawForStart.end_date}`);
          // Write your luckyDraw execution logic here
          console.log(">>>>>>>>>YES I am Working", new Date());
          console.log("end LD Call");
          commonController.endLuckyDraw(LId);
        });

      }


    }
    catch (error) {
      logger.error("error in lucky draw update status", error.message);
      console.log("error in luckydraw update status", error);
    }
  },
  startLuckyDraw: async (LId) => {
    try {
      let luckyDrawForStart = await models.LuckyDrawModel.findOne({
        where: {
          id: LId,
          status: 0,
          esign_status: 2
        },
        raw: true
      })

      if (luckyDrawForStart) {
        await models.LuckyDrawModel.update({
          status: 1
        }, {
          where: {
            id: LId
          }
        });
      }
    }
    catch (error) {
      logger.error("error in lucky draw update status", error.message);
      console.log("error in luckydraw update status", error);
    }
  },
  endLuckyDraw: async (LId) => {
    try {

      //End Lucky Draw
      console.log("end LD");
      let luckyDrawForStart = await models.LuckyDrawModel.findOne({
        where: {
          id: LId,
          [Op.or]: [
            { status: 1, }, { status: 2 }],
          esign_status: 2
        },
        raw: true
      })

      if (luckyDrawForStart) {
        await models.LuckyDrawModel.update({
          status: 3
        }, {
          where: {
            id: LId
          }
        });
      }
    }
    catch (error) {
      logger.error("error in lucky draw update status", error.message);
      console.log("error in luckydraw update status", error);
    }
  },
}


module.exports = commonController;
async function getUIDAndLevelNew(code, sku = null) {
  let UID, level;
  let dynamicCode = code[2] + code[6] + code[8];
  let dynamicUID;
  if (sku == null) {
    dynamicUID = await DynamicUIDModel.findOne({
      where: {
        code: dynamicCode
      },
      raw: true
    })
  } else {
    dynamicUID = await models.productsModel.findOne({ where: { [Op.or]: [{ sku: sku }, { gtin: sku }] }, raw: true });
  }


  if (!dynamicUID) {
    console.log("-------------Dynamic UID Not Found");
    let Product = await models.productsModel.findOne({ where: { [Op.or]: [{ sku: sku }, { gtin: sku }] }, raw: true });
    if (Product) {
      UID = Product.u_id;
    }
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

  return {
    UID: UID,
    level: level,
    uniqueCode: code
  }
}


async function getUIDAndLevel(code) {
  try {
    let UID;
    let level;
    let uniqueCode;
    if (code.includes('?V:2')) {  //V:version:: V2 : Latest TrustTag Codes 
      let split1 = code.split('~')
      console.log("----Split1::", split1);

      level = split1[1].split(':')[1];
      console.log("----Level::", level);

      uniqueCode = split1[2].split(':')[1]
      console.log("----Unique Code::", uniqueCode);

      level = level == 1 ? level = 'P' : level == 2 ? 'S' : level == 3 ? 'O' : level == 4 ? 'T' : null;

      let dynamicCode = uniqueCode[2] + uniqueCode[6] + uniqueCode[8];
      let dynamicUID = await DynamicUIDModel.findOne({
        where: {
          code: dynamicCode
        },
        raw: true
      })

      if (!dynamicUID) {
        console.log("-------------Dynamic UID Not Found");
        return false;
      } else {
        UID = dynamicUID.u_id
      }
    }
    else {   //  V:1 Previos version codes
      console.log("-------Previous Code")
      if (code.length == 10) {
        uniqueCode = code;
      } else {
        if (code.includes('?V:1')) {
          let split1 = code.split('~')
          console.log("----Split1::", split1);

          level = split1[1].split(':')[1];
          console.log("----Level::", level);

          uniqueCode = split1[2].split(':')[1]
        } else {
          let split1 = code.split('HTTPS://DHANUKA.COM/SAM/');
          if (split1.length != 2) {
            return false
          }
          console.log("Split 1::", split1);
          let split2 = split1[1].split('?');
          if (split2.length != 2) {
            return false
          }
          console.log("Split 2::", split2);
          uniqueCode = split2[0];
        }
      }
      console.log("Unique Code::", uniqueCode);
      let xCodeDetails = await XCompanyCodes.findOne({
        where: {
          unique_code: uniqueCode
        },
        raw: true
      })

      if (!xCodeDetails) {
        return false;
      }

      UID = xCodeDetails.u_id;
      level = xCodeDetails.level
    }


    return {
      uniqueCode: uniqueCode,
      UID: UID,
      level: level
    }
  } catch (error) {
    console.log(error);
    return false
  }
}

async function splitUID(code) {
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

  return {
    UID: UID,
    level: level,
    uniqueCode: code
  }
}
async function getCronExpression(date) {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1; // Months are zero-indexed
  const dayOfWeek = date.getDay();

  return `${minute} ${hour} ${dayOfMonth} ${month} *`;
  // 2 19 29 4 1
}

function AddMinutesToDate(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function compareDates(a, b) {
  // Compare two dates (could be of any type supported by the convert
  // function above) and returns:
  //  -1 : if a < b
  //   0 : if a = b
  //   1 : if a > b
  // NaN : if a or b is an illegal date
  return (
    isFinite(a == convert(a).valueOf()) &&
      isFinite(b == convert(b).valueOf()) ?
      (a > b) - (a < b) :
      NaN
  );
}

function ValidateFileType(files) {
  if (files.name.match(/\.(jpg|jpeg|png|gif|JPG|JPEG|PNG|GIF)$/)) {
    return true;
  }
  return false;
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

async function EncodeQrCodes(TU, SC) {
  let code = SC[0] + TU[0] + SC[1] + TU[1] + SC[2] + TU[3] + SC[3] + TU[4] + SC[4] + SC[5] + TU[5] + SC[6] + TU[3] + SC[7];
  // TUID = 1 3 5 7 10 12 
  // code = 0 2 4 6 8 9 11 13
  return code;
}

async function DecodeQrCodes(code) {
  let tableUid = code[1] + code[3] + code[5] + code[7] + code[10] + code[12];
  let qrCode = code[0] + code[2] + code[4] + code[6] + code[8] + code[9] + code[11] + code[13];
  return { tableUid, qrCode }
}