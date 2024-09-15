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


const rackLocationDiscountController = {

  addOrUpdateRackLocation: async (req, res) => {

    try {
      try {
        let validator = new v(req.body, {
          // bill_date: "required",
          // due_date: "required",
          // invoice_no: "required",
          // items: "required|array",
          // po_date: "required",
          // po_no: "required",
          // distributor_id: "required",
        });

        let matched = await validator.check();
        if (!matched) {
          let validatorError = await controllers.parseValidate(validator.errors)
          return res.status(200).send({ success: 0, message: validatorError });
        }
        if (!req.tableUid) {
          return res.status(200).send({ success: 0, message: "Table uid Not Available" });
        }

        //Dynamic Models
        let productStockSchema = await models.dynamicModel.getProductStockModel(req.tableUid);
        let batchStockSchema = await models.dynamicModel.getBatchStockModel(req.tableUid);

        //-----------------------------validations 

        // console.log(">>>>>>>>>>>>>>>>>>>req.body", req.body);
        // console.log(">>>>>>>>>>>>req.body.items", req.body.resultData);

        console.log(">>>>>>>>>>>>>>>>>>>>>>>check 1>>>>>>>>>>>>>>>");

        await req.body.forEach(async (element) => {
          let productExist = await productStockSchema.findOne({
            where: {
              retailer_id: req.retailerId,
              retail_outlet_id: req.retailOutletId,
              product_id: element.product_id
            },
            raw: true
          });

          //------------------PRODUCT-------------update=> loc_in_store, max_qty, min_qty, hsn, qty
          if (productExist) {
            console.log(">>>>>>>>>>>>>>>>>>>>>>>check 2>>>>>>>>>>>>>>>");
            await productStockSchema.update({
              rack_no: element.rack_no,
              min_stock: element.min_stock,
              max_stock: element.max_stock,
              hsn_code: element.hsn_code,
              qty: element.qty
            }, {
              where: {
                retailer_id: req.retailerId,
                retail_outlet_id: req.retailOutletId,
                product_id: element.product_id,
              }
            })
            console.log("<<<<<<<<<product details updated", element.rack_no);
            console.log("<<<<<<<<<elemetn", element);
          }
          else {
            console.log(">>>>>>>>>>>>>>>>>>>>>>>check Product_id>>>>>>>>>>>>>>>", element.product_id);
            console.log(">>>>>>>>>>>>>>>>>>>>>>>check 3>>>>>>>>>>>>>>>");
            // return res.status(200).send({ success: 0, message: "Product Not Available" });
          }


          let batchExist = await batchStockSchema.findOne({
            where: {
              retailer_id: req.retailerId,
              retail_outlet_id: req.retailOutletId,
              product_id: element.product_id,
              batch_id: element.batch_id,
            },
            raw: true
          });

          if (batchExist) {
            console.log(">>>>>>>>>>>>>>>>>>>>>>>check 5>>>>>>>>>>>>>>>");

            //------------------BATCH-------------update=> loc_in_store, max_qty, min_qty, hsn, qty
            await batchStockSchema.update({

              qty: element.qty,
              rack_no: element.rack_no,
              min_stock: element.min_stock,
              max_stock: element.max_stock,
              sale_rate: element.sale_rate,
              discount_percentage: element.discount_percentage,
              margin_percentage: element.margin_percentage,
              hsn_code: element.hsn_code,
              mrp: element.mrp,
              ptr: element.ptr,

            }, {
              where: {
                id: element.id,
                retailer_id: req.retailerId,
                retail_outlet_id: req.retailOutletId,
                product_id: element.product_id,
                batch_id: element.batch_id,
              }
            })
            console.log("<<<<<<<<<batch details updated>>>>>>>>>>>>>>>>>", element.loc_in_store);
          }
          else {
            console.log(">>>>>>>>>>>>>>>>>>>>>>>check 6>>>>>>>>>>>>>>>");
            // return res.status(200).send({ success: 0, message: "Batch Not Available" });
          }
        })
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>overrrrrrrrrrrrrrrrr");
        return res.status(200).send({ success: 1, message: "Location & Discount added successfully" });

      } catch (ex) {
        console.log(ex);
      }
    }
    catch (ex) {
      console.log(ex);
    }
  },

}



module.exports = rackLocationDiscountController;
