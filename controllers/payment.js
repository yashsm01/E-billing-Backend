
const v = require("node-input-validator");
const uuid = require("uuid");
const randomstring = require("randomstring");
const fs = require("fs");
const path = require("path");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const db = require('../models');
const moment = require('moment');


// models
let models = require("./_models");
// controller
const controllers = require("./_controller");

const paymentcontroller = {
  list: async (req, res) => {
    try {
      let whereClause = {
        retailer_id: req.retailerId,
        retail_outlet_id: req.retailOutletId
      };
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

      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }

      let retailDistMasterModel = await models.dynamicModel.getRetailDistributorMasterModel(req.tableUid);
      console.log(retailDistMasterModel, "retailDistMasterModel...............")

      let data = await retailDistMasterModel.findAll({
        where: whereClause,
        include: [
          {
            model: models.RetailerModel,
            attributes: ['id', 'name'],
            as: 'retailers',
            raw: true,
            nest: true
          },
          {
            model: models.retailerOutletsModels,
            attributes: ['id', 'name'],
            as: 'retailer_outlets',
            raw: true,
            nest: true
          },
          {
            model: models.DistributorsModel,
            attributes: ['id', 'name'],
            as: 'distributors',
            raw: true,
            nest: true
          }

        ],
        nest: true,
        raw: true
      })
      console.log("Data", data)
      return res.status(200).send({
        success: 1,
        data: data,
      })

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  cust_list: async (req, res) => {
    try {
      let whereClause = {
        retailer_id: req.retailerId,
        retail_outlet_id: req.retailOutletId
      };
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

      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }

      let retailMasterModel = await models.dynamicModel.getRetailCustomerMasterModel(req.tableUid);
      console.log(retailMasterModel, "retailCustMasterModel...............")

      let data = await retailMasterModel.findAll({
        where: whereClause,
        include: [
          {
            model: models.RetailerModel,
            attributes: ['id', 'name'],
            as: 'retailers',
            raw: true,
            nest: true
          },
          {
            model: models.retailerOutletsModels,
            attributes: ['id', 'name'],
            as: 'retailer_outlets',
            raw: true,
            nest: true
          },
          {
            model: models.ConsumersModel,
            attributes: ['id', 'first_name', 'last_name'],
            as: 'consumers',
            raw: true,
            nest: true
          }

        ],
        nest: true,
        raw: true
      })
      console.log("Data", data)
      return res.status(200).send({
        success: 1,
        data: data,
      })

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },

  list_distritbutor: async (req, res) => {
    try {

      distributor_id: req.params.distributor_id;

      //////////////////////////////////////////////
      console.log("01");
      //////////////////////////////////////////////

      let validator = new v(req.params, {
        distributor_id: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      //////////////////////////////////////////////
      console.log("02");
      //////////////////////////////////////////////

      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }

      //////////////////////////////////////////////
      console.log("03");
      //////////////////////////////////////////////

      let purchaseModel = await models.puchaseSchema(req.tableUid);

      let purchaseOrder = await purchaseModel.purchaseOrderModels.findAll({
        where: {
          distributor_id: req.params.distributor_id,
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId,
          payment_status: 0,
          is_return: false
        },
        include: [
          {
            model: models.DistributorsModel,
            attributes: ['id', 'name'],
            as: 'distributors',
            raw: true,
            nest: true
          },
          {
            model: purchaseModel.retailDistributorModels,
            where: { retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId },
            // attributes: ['order_count', 'pending_count', 'payment_amount', 'pending_amount'],
            as: 'retail_distributor',
            required: false,
            raw: true,
            nest: true
          }
        ],
        raw: true,
        nest: true
      })

      console.log("purchaseOrderpurchaseOrder", purchaseOrder);

      return res.status(200).send({
        success: 1,
        data: purchaseOrder,
      })

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  list_customer: async (req, res) => {
    try {

      customer_id: req.params.customer_id;

      //////////////////////////////////////////////
      console.log("01");
      //////////////////////////////////////////////

      let validator = new v(req.params, {
        customer_id: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      //////////////////////////////////////////////
      console.log("02");
      //////////////////////////////////////////////

      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }

      //////////////////////////////////////////////
      console.log("03");
      //////////////////////////////////////////////


      let salesModel = await models.dynamicModel.getSalesModel(req.tableUid);
      console.log(salesModel, "sales...............")

      let whereClause = {
        retailer_id: req.retailerId,
        retail_outlet_id: req.retailOutletId,
        is_return: false,
        customer_id: req.params.customer_id,
        payment_status: 0,
      };

      let salesList = await salesModel.findAll({
        where: whereClause,
        include: [
          {
            model: models.RetailerModel,
            attributes: ['id', 'name'],
            as: 'retailers',
          },
          {
            model: models.retailerOutletsModels,
            attributes: ['id', 'name'],
            as: 'retailer_outlets',
          },
          {
            model: models.ConsumersModel,
            attributes: ['id', 'first_name', 'last_name'],
            as: 'consumers',
            raw: true,
            nest: true
          },
          {
            model: models.doctorsModel,
            attributes: ['id', 'first_name', 'last_name'],
            as: 'doctors',
            raw: true,
            nest: true
          },

        ],
        nest: true,
        raw: true
      })

      //--------------if saleslist array is empaty--------------------------------

      if (salesList.length == 0) {

        return res.status(200).send({
          success: 0,
          message: "No data Available"

        })


      }
      return res.status(200).send({
        success: 1,
        data: salesList,
      })

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }

  },
  clear_distritbutor: async (req, res) => {
    try {
      let distributor_id = req.params.distributor_id;

      let validator = new v(req.params, {
        distributor_id: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }
      let retailDistMasterModel = await models.dynamicModel.getRetailDistributorMasterModel(req.tableUid);
      console.log(retailDistMasterModel, "retailDistMasterModel...............")
      let purchaseModel = await models.puchaseSchema(req.tableUid);
      // Fetch the distriBitorMasterModel for the given distributor_id
      let distributorMaster = await retailDistMasterModel.findAll({
        where: {
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId,
          distributor_id: distributor_id,
        }
      });
      let purchaseOrder = await purchaseModel.purchaseOrderModels.findAll({
        where: {
          distributor_id: req.params.distributor_id,
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId,
          payment_status: 0,
          payment_type: 1,
          is_return: false,
        },
      })
      if (distributorMaster) {

        await retailDistMasterModel.update({
          pending_count: 0,
          pending_amount: 0,
          return_pending_amount: 0,
          return_pending_count: 0,
        }, {
          where: {
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            distributor_id: distributor_id,
          }
        })

        console.log("Distributor master updated successfully");
      } else {
        console.log("Distributor master not found");
      }
      if (purchaseOrder) {
        await purchaseModel.purchaseOrderModels.update({
          payment_status: 2,
          payment_type: 0,
        }, {
          where: {
            distributor_id: req.params.distributor_id,
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            payment_status: 0,
            payment_type: 1,
          }
        })
      }

      return res.status(200).send({
        success: 1,
        message: "Distributor Payment Updated Successfully",
      });

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  clear_customer: async (req, res) => {
    try {

      let customer_id = req.params.customer_id;

      let validator = new v(req.params, {
        customer_id: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }

      let retailMasterModel = await models.dynamicModel.getRetailCustomerMasterModel(req.tableUid);
      console.log(retailMasterModel, "retailMasterModel...............")
      let salesModel = await models.dynamicModel.getSalesModel(req.tableUid);

      let customerMaster = await retailMasterModel.findAll({
        where: {
          consumer_id: customer_id,
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId,
        }
      });

      let salesOrder = await salesModel.findAll({
        where: {
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId,
          is_return: false,
          customer_id: req.params.customer_id,
          payment_status: 0,
        },
      })

      if (customerMaster) {

        await retailMasterModel.update({
          pending_count: 0,
          pending_amount: 0,
          return_pending_amount: 0,
          return_pending_count: 0,
        }, {
          where: {
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            consumer_id: customer_id,
          }

        })
        console.log("Distributor master updated successfully");
      } else {
        console.log("Distributor master not found");
      }


      if (customerMaster) {

        await retailMasterModel.update({
          pending_count: 0,
          pending_amount: 0,
        }, {
          where: {
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            consumer_id: customer_id,
          }

        })
        console.log("Customer master updated successfully");
      } else {
        console.log("Customer master not found");
      }


      if (salesOrder) {
        await salesModel.update({
          payment_status: 2,
          payment_type: 0,
        }, {
          where: {
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            customer_id: req.params.customer_id,
            payment_status: 0,
          }
        })
      }

      return res.status(200).send({
        success: 1,
        message: "Customer Payment Updated Successfully",
      })

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }

  },

}


module.exports = paymentcontroller