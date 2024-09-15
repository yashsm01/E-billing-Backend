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

// models
let models = require("./_models");
// controller
const controllers = require("./_controller");

/**
 * @owner Yash Modi
 * @description Purchase order master
 */
const purchaseOrderController = {

  add: async (req, res) => {
    try {
      let validator = new v(req.body, {
        bank_name: "required",
        ifsc_code: "required",
        account_no: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
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

      let dynamicBankDetailsModel = await models.dynamicModel.getBankDetailsModel(retailOutletDetails.table_uid);

      const bankId = uuid();
      let data = {
        id: bankId,
        retailer_id: req.retailerId,
        retail_outlet_id: req.retailOutletId,
        bank_name: req.body.bank_name,
        ifsc_code: req.body.ifsc_code,
        account_no: req.body.account_no,
      }
      await dynamicBankDetailsModel.create(data);
      return res.status(200).send({ success: 1, message: "Bank Details added successfully" });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },

  list: async (req, res) => {
    try {
      let whereClause = {
        retailer_id: req.retailerId,
        retail_outlet_id: req.retailOutletId
      }


      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
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

      let dynamicBankDetailsModel = await models.dynamicModel.getBankDetailsModel(retailOutletDetails.table_uid);


      let allBanks = await dynamicBankDetailsModel.findAll({
        where: whereClause,
        order: [['updatedAt', 'DESC']],
        raw: true,
        nest: true
      });
      if (allBanks.length == 0) {
        return res.status(200).send({ success: 0, message: "Please Add Payment Bank" });
      }
      // console.log(">>>>>>>> all Doctors", allBanks);
      return res.status(200).send({ success: 1, data: allBanks })

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  }

};

module.exports = purchaseOrderController;



