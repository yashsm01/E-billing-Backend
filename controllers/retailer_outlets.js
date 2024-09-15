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
const retailerOutletController = {

  current: async (req, res) => {
    try {
      let retailerId = req.retailerId;
      let retail_Outlet_Id = req.retailOutletId;
      let whereClause = {
        retailer_id: req.retailerId,
        id: req.retailOutletId
      };

      let retailerOutlets = await models.retailerOutletsModels.findAll({
        where: whereClause,
        include: [{
          model: models.RetailerModel,
          attributes: ['name'],
          as: 'retailers',
          raw: true,
          nest: true
        },
        ],
        nest: true,
        raw: true
      })
      if (retailerOutlets.length == 0) {

        return res.status(200).send({
          success: 0,
          message: "No data Available"

        })
      }
      return res.status(200).send({ success: 1, data: retailerOutlets, message: "Pharmacy Outlet Detail" });

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(200).send({
        message: error.toString()
      });
    }
  },

  list: async (req, res) => {
    try {
      let whereClause = {
        retailer_id: req.retailerId
      };

      if (req.roleId === 2) {
        whereClause.id = req.retailOutletId;
      }
      let dateFilter = [];
      if (req.query.startDate) {
        dateFilter.push({ createdAt: { [Op.gte]: moment(req.query.startDate).format("YYYY-MM-DD") + " 00:00:00" } });
      }
      if (req.query.endDate) {
        dateFilter.push({ createdAt: { [Op.lte]: moment(req.query.endDate).format("YYYY-MM-DD") + " 23:59:59" } });
      }
      if (dateFilter.length > 0) {
        whereClause[Op.and] = dateFilter;
      }
      let retailerOutlets = await models.retailerOutletsModels.findAll({
        where: whereClause,
        include: [{
          model: models.RetailerModel,
          attributes: ['name'],
          as: 'retailers',
          raw: true,
          nest: true
        },
        ],
        nest: true,
        raw: true
      })
      if (retailerOutlets.length == 0) {

        return res.status(200).send({
          success: 0,
          message: "No data Available"

        })
      }
      return res.status(200).send({ success: 1, data: retailerOutlets, message: "Pharmacy Outlet List" });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(200).send({
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
      let retailers = await models.retailerOutletsModels.findOne({
        where: {
          id: req.params.id
        },
        raw: true
      });
      return res.status(200).send({ success: 1, data: retailers, message: "Pharmacy Outlet details" });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  add: async (req, res) => {


    try {
      let tableUid = moment(new Date()).format('MM_YYYY');
      let validator = new v(req.body, {
        //group 1
        pharmacyOutletName: "required",
        pharmacistName: "required",
        mobileNumber: "required",
        email: "required",
        gstIn: "required",
        licNo: "required",
        //group 2
        address: "required",
        area: "required",
        city: "required",
        pincode: "required",
        //group 3
        countryId: "required",
        stateId: "required",
        cityId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      const retailerOutletId = uuid();

      //add retailer outlet image
      let imageURL = '';
      if (req.files) {
        if (req.files.image) {
          let response = await controllers.commonController.s3AddImage(req.files.image, retailerOutletId, "retailer-image");
          if (response.success == 0) {
            return res.status(200).send({ success: 0, message: response.message });
          }
          imageURL = response.data;
        }
      }


      console.log(">>>>>>>>>>>>>imageURL", imageURL);
      await models.dynamicModel.getPurchaseOrderModel(tableUid, true);//create purches order table 
      await models.dynamicModel.getPurchaseOrderDetailsModel(tableUid, true);//create purches order detail table 
      await models.dynamicModel.getProductStockModel(tableUid, true);//create product stock order table
      await models.dynamicModel.getBatchStockModel(tableUid, true);//create product stock order table
      await models.dynamicModel.getRetailCustomerModel(tableUid, true);//create retail customer table 
      await models.dynamicModel.getRetailDistributorMasterModel(req.tableUid, true);
      await models.dynamicModel.getRetailCustomerMasterModel(req.tableUid, true);
      await models.dynamicModel.getBankDetailsModel(req.tableUid, true);

      await models.retailerOutletsModels.create({
        id: retailerOutletId,
        retailer_id: req.retailerId,
        //group 1
        name: req.body.pharmacyOutletName,
        pharmacist_name: req.body.pharmacistName,
        contact: req.body.mobileNumber,
        email: req.body.email,
        gstin: req.body.gstIn,
        lic_no: req.body.licNo,
        //group 2
        address: req.body.address,
        area: req.body.area,
        city: req.body.city,
        pincode: req.body.pincode,
        //group 3
        country_id: req.body.countryId,
        state_id: req.body.stateId,
        city_id: req.body.cityId,
        table_uid: tableUid,
        image: null
      });

      return res.status(200).send({ success: 1, message: "Pharmacy Outlet Added" });
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
        //group 1
        pharmacyOutletName: "required",
        pharmacistName: "required",
        mobileNumber: "required",
        email: "required",
        gstIn: "required",
        licNo: "required",
        //group 2
        address: "required",
        area: "required",
        city: "required",
        pincode: "required",
        //group 3
        countryId: "required",
        stateId: "required",
        cityId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      await models.retailerOutletsModels.update({
        //group 1
        name: req.body.pharmacyOutletName,
        pharmacist_name: req.body.pharmacistName,
        contact: req.body.mobileNumber,
        email: req.body.email,
        gstin: req.body.gstIn,
        lic_no: req.body.licNo,
        //group 2
        address: req.body.address,
        area: req.body.area,
        city: req.body.city,
        pincode: req.body.pincode,
        //group 3
        country_id: req.body.countryId,
        state_id: req.body.stateId,
        city_id: req.body.cityId,
        image: null
      }, {
        where: {
          id: req.params.id
        }
      });
      return res.status(200).send({ success: 1, message: "Pharmacy Outlet Added" });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  }
};

module.exports = retailerOutletController;