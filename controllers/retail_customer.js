const v = require("node-input-validator");
const uuid = require("uuid");
const randomstring = require("randomstring");
const fs = require("fs");
const path = require("path");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const db = require('../models');
const logger = require('../helpers/logger');
const Retailer = require("../models").retailers;

// Middleware
const message = require("../i18n/en");

// Models
let models = require("./_models");
const retailer_outlets = require("../models/retailer_outlets");
const consumerModel = require("../models/").consumers;

// Controller
const controllers = require("./_controller");

const retail_customer = {

  search: async function (req, res) {
    try {
      if (!req.tableUid) {
        return res.status(400).send({ success: 0, message: "Table UID not available" });
      }

      const searchQuery = req.body.search ? req.body.search.trim() : '';
      const limit = parseInt(req.body.limit, 10) || 10; // Limit the number of results
      const offset = parseInt(req.body.offset, 20) || 0; // Pagination offset

      // Check if searchQuery is empty
      if (!searchQuery) {
        return res.status(200).send({
          success: 1,
          data: [],
          total: 0
        });
      }
      let customerSchema = await models.customerSchema(req.tableUid);
      // let dynamicRetailModel = await models.dynamicModel.getRetailCustomerModel(req.tableUid);

      let retailCustomerList = await customerSchema.retailCustomerModel.findAndCountAll({
        where: {
          retailer_id: req.retailerId,
          [Op.or]: [
            { '$consumers.phone$': { [Op.iLike]: `%${searchQuery}%` } },
            { '$consumers.first_name$': { [Op.iLike]: `%${searchQuery}%` } },
            { '$consumers.last_name$': { [Op.iLike]: `%${searchQuery}%` } }
          ]
        },
        include: [
          {
            model: customerSchema.customerModels,
            // attributes: ['id', 'first_name', 'last_name', 'phone', 'email'],
            attributes: ['id', 'first_name', 'last_name', 'phone', 'email', 'address', 'country_name', 'state_name', 'city_name', 'pincode', 'discount_percentage', 'country_code', 'state_id', 'city_id'],
            as: 'consumers',
            raw: true,
            nest: true
          },
          {
            model: customerSchema.retailCustomerMasterModels,
            where: { retailer_id: req?.retailerId ?? null, retail_outlet_id: req?.retailOutletId ?? null },
            as: "retail_customer",
            required: false,
            raw: true,
            nest: true
          }
        ],
        limit: limit,
        offset: offset,
        nest: true,
        raw: true
      });

      return res.status(200).send({
        success: 1,
        data: retailCustomerList.rows,
        total: retailCustomerList.count
      });
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: error.toString()
      });
    }
  },

  list: async function (req, res) {
    try {
      if (!req.tableUid) {
        return res.status(400).send({ success: 0, message: "Table UID not available" });
      }

      let dynamicRetailModel = await models.dynamicModel.getRetailCustomerModel(req.tableUid);

      let retailCustomerList = await dynamicRetailModel.findAll({
        where: {
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId
        },
        include: [
          {
            model: models.ConsumersModel,
            attributes: ['id', 'first_name', 'last_name', 'phone'],
            as: 'consumers',
            raw: true,
            nest: true
          }
        ],
        nest: true,
        raw: true
      });

      if (retailCustomerList.length === 0) {
        return res.status(200).send({
          success: 0,
          message: "Customer details are currently unavailable. Please try again later."
        });
      }

      console.log("All consumers:", retailCustomerList);
      return res.status(200).send({
        success: 1,
        data: retailCustomerList
      });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: error.toString()
      });
    }
  },

  addRetailCustomer: async (req, res) => {
    try {
      let validator = new v(req.body, {
        phoneNumber: "required|minLength:10|maxLength:10",
        email: "email|maxLength:255",
        firstName: "required|minLength:2|maxLength:40",
        lastName: "minLength:2|maxLength:40",
        // countryId: "required",
        // stateId: "required",
        // cityId: "required",
        address: "minLength:2|maxLength:255",
        pincode: "minLength:6|maxLength:6",
        // discountPercentage: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: validatorError });
      }

      let consumerDetail = await consumerModel.findOne({
        where: {
          phone: req.body.phoneNumber
        }
      });
      if (consumerDetail) {
        return res.status(200).send({ success: 0, message: "Customer is already added (with SAME Phone Number)!" });
      }

      let retailerId = req.retailerId;
      let retail_Outlet_Id = req.retailOutletId;

      let retailOutletDetails = await models.retailerOutletsModels.findOne({
        where: {
          id: req.retailOutletId
        },
        raw: true
      });
      if (!retailOutletDetails) {
        return res.status(400).send({ success: 0, message: "Retail outlet details not found" });
      }

      let dynamicRetailModel = await models.dynamicModel.getRetailCustomerModel(retailOutletDetails.table_uid);


      let city_name;
      if (req.body.cityId) {
        let cityDetails = await models.cityModel.findOne({ where: { id: req.body.cityId }, raw: true });
        city_name = cityDetails.name;
      }

      let state_name;
      if (req.body.stateId) {
        let stateDetails = await models.stateModel.findOne({ where: { id: req.body.stateId }, raw: true });
        state_name = stateDetails.name;
      }

      let country_name;
      if (req.body.countryId) {
        let countryDetails = await models.countriesModel.findOne({ where: { id: req.body.countryId }, raw: true });
        country_name = countryDetails.name;
      }


      let consumer_id = uuid();
      let consumer = {
        id: consumer_id,
        retailer_id: retailerId,
        retail_outlet_id: retail_Outlet_Id,
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        phone: req.body.phoneNumber,
        email: req.body.email,
        pincode: req.body.pincode,
        country_code: req.body.countryId,
        state_id: req.body.stateId,
        city_id: req.body.cityId,
        address: req.body.address,
        discount_percentage: req.body.discountPercentage ?? null,
        is_contact_verified: req.body.is_contact_verified ? req.body.is_contact_verified : true,
        is_email_verified: req.body.is_email_verified ? req.body.is_email_verified : true,
        country_name: country_name,
        state_name: state_name,
        city_name: city_name
      };
      await consumerModel.create(consumer);

      let retail_consumer = {
        id: uuid(),
        retailer_id: retailerId,
        retail_outlet_id: retail_Outlet_Id,
        consumer_id: consumer_id
      };

      await dynamicRetailModel.create(retail_consumer);

      res.status(200).send({ success: 1, message: "Retail customer added!" });
    } catch (ex) {
      console.log(ex);
      controllers.logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },

  update: async (req, res) => {
    try {
      let validator = new v(req.body, {
        phoneNumber: "required|minLength:10|maxLength:10",
        email: "email|maxLength:255",
        firstName: "required|minLength:2|maxLength:40",
        lastName: "minLength:2|maxLength:40",
        // countryId: "required",
        // stateId: "required",
        // cityId: "required",
        address: "minLength:2|maxLength:500",
        pincode: "minLength:6|maxLength:6",
        discountPercentage: "max: 150",
      });

      let matched = await validator.check();
      if (!matched) {
        return res
          .status(200)
          .send({
            success: 0,
            message: validator.errors
          });
      }

      let retailCustomerId = req.params.retailCustomerId;

      let city_name;
      if (req.body.cityId) {
        let cityDetails = await models.cityModel.findOne({ where: { id: req.body.cityId }, raw: true });
        city_name = cityDetails.name;
      }

      let state_name;
      if (req.body.stateId) {
        let stateDetails = await models.stateModel.findOne({ where: { id: req.body.stateId }, raw: true });
        state_name = stateDetails.name;
      }

      let country_name;
      if (req.body.countryId) {
        let countryDetails = await models.countriesModel.findOne({ where: { id: req.body.countryId }, raw: true });
        country_name = countryDetails.name;
      }

      let updateRetailCustomer = {
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        phone: req.body.phoneNumber,
        email: req.body.email,
        pincode: req.body.pincode,
        country_code: req.body.countryId,
        state_id: req.body.stateId,
        city_id: req.body.cityId,
        address: req.body.address,
        discount_percentage: req.body.discountPercentage ?? null,
        is_contact_verified: req.body.is_contact_verified ? req.body.is_contact_verified : true,
        is_email_verified: req.body.is_email_verified ? req.body.is_email_verified : true,
        country_name: country_name,
        state_name: state_name,
        city_name: city_name
      }

      console.log("updateRetailCustomerupdateRetailCustomerupdateRetailCustomer", retailCustomerId);
      console.log('updateRetailCustomer>>>>>>>', updateRetailCustomer);
      const isUpdated = await consumerModel.update(updateRetailCustomer, {
        where: {
          id: retailCustomerId,
        },
      });

      if (isUpdated < 1) {
        return res.status(200).send({ success: 0, message: "Customer's details hasn't updated. " });
      }

      return res.status(200).send({ success: 1, message: "Customer's details updated successfully." });
    } catch (ex) {
      console.error(ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
};

module.exports = retail_customer;
