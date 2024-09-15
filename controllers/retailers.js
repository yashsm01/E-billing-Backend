const v = require("node-input-validator");
const uuid = require("uuid");
const randomstring = require("randomstring");
const fs = require("fs");
const path = require("path");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const db = require('../models');
const moment = require('moment');

//middleware
const message = require("../i18n/en");
let AddInProgress = false;
let updateInProgress = false;

// models
let models = require("./_models");
// controller
const controllers = require("./_controller");

/**
 * @owner Yash Modi
 * @description Retailer Outlet master
 */
const retailerController = {
  list: async (req, res) => {
    try {
      let whereClause;
      let dateFilter = [];
      if (req.query.startDate) {
        dateFilter.push({ createdAt: { [Op.gte]: moment(req.query.startDate).format("YYYY-MM-DD") + " 00:00:00" } });
      }
      if (req.query.endDate) {
        dateFilter.push({ createdAt: { [Op.lte]: moment(req.query.endDate).format("YYYY-MM-DD") + " 23:59:59" } });
      }
      if (dateFilter.length > 0) {
        whereClause = dateFilter;
      }
      let retailers = await models.RetailerModel.findAll({
        where: whereClause,
        raw: true
      });
      if (retailers.length == 0) {

        return res.status(200).send({
          success: 0,
          message: "No data Available"

        })
      }
      return res.status(200).send({ success: 1, data: retailers, message: "Pharmacy List" });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  details: async (req, res) => {
    try {
      let validator = new v(req.params, {
        id: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      let retailers = await models.RetailerModel.findOne({
        where: {
          retailer_id: req.params.id
        },
        raw: true
      });
      return res.status(200).send({ success: 1, data: retailers, message: "Pharmacy details" });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  update: async (req, res) => {
    try {
      let validator = new v(req.body, {

      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      return res.status(200).send({ success: 1, message: "Pharmacy Outlet Updated" });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  }
};

module.exports = retailerController;