const v = require('node-input-validator');
const message = require('../i18n/en');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const uuid = require("uuid");
const moment = require('moment');

// models
const db = require('../models');
const models = require("./_models");
const ProductBatchModel = require('../models/').product_batches;

const Product = require("../models/").products;


// controller
const controllers = require("./_controller");

const commonController = require('../controllers/common')
var product_batch = {

  checkBatch: async function (req, res) {
    try {
      let validator = new v(req.query, {
        productId: "required",
        batchNo: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: validatorError });
      }
      let batchExists = await ProductBatchModel.findOne({
        where: {
          batch_no: (req.query.batchNo).toUpperCase(),
          product_id: req.query.productId
        },
        raw: true
      })
      if (batchExists) {
        return res.status(200).send({ success: 0, message: "Batch Exists select from list", batchDetails: batchExists })
      }
      return res.status(200).send({ success: 1, message: "Available" });

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  scanBatchList: async (req, res) => {
    try {
      let validator = new v(req.params, {
        productId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: validatorError });
      }

      let batchList = await ProductBatchModel.findAll({
        where: {
          product_id: req.params.productId
        },
        raw: true
      })

      return res.status(200).send({ success: 1, data: batchList });

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }

  },
  productBatchList: async (req, res) => {
    try {
      let validator = new v(req.params, {
        productId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: validatorError });
      }
      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      let retailBatchSchema = await models.retailerBatchSchema(req.tableUid);
      let BatchList = await retailBatchSchema.retailBatchModels.findAll({
        where: {
          retailer_id: req?.retailerId ?? null,
          retail_outlet_id: req?.retailOutletId ?? null,
          product_id: req.params.productId,
          exp_date: {
            [Op.gt]: yesterday
          }
        },
        include: [
          {
            model: retailBatchSchema.batchStockModels,
            where: { retailer_id: req?.retailerId ?? null, retail_outlet_id: req?.retailOutletId ?? null },
            required: false,
            attributes: ['rack_no', 'discount_percentage', 'mrp', 'margin_percentage', 'qty', 'unit_qty'],
            as: 'batchStock',
            raw: true,
            nest: true
          },
        ],
        order: [['createdAt', 'DESC']],
        raw: true,
        nest: true
      })
      if (BatchList.length == 0) {
        return res.status(200).send({ success: 1, message: "No Batch Available" });
      }
      return res.status(200).send({ success: 1, data: BatchList });

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }

  },

  getBatchById: async function (req, res) {
    try {
      let validator = new v(req.params, {
        batchId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }
      let batchExists = await ProductBatchModel.findOne({
        where: {
          id: req.params.batchId
        },
        raw: true
      })
      if (!batchExists) {
        return res.status(200).send({ success: 0, message: "Batch Not Found" })
      }
      return res.status(200).send({ success: 1, data: batchExists });

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },

  add: async function (req, res) {
    try {
      let validator = new v(req.body, {
        mfgDate: 'required',
        expDate: 'required',
        productId: 'required',
        mrp: 'required',
        location: 'required',
        batchNo: 'required'
      });
      let matched = await validator.check();

      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let batchNo = req.body.batchNo;

      const isExists = await ProductBatchModel.count({
        where: {
          product_id: req.body.productId,
          batch_no: {
            [Op.iLike]: batchNo
          }
        }
      });

      if (isExists > 0) {
        return res.send({ success: 0, message: "Batch already found!" });
      }

      let productInfo = await Product.findOne({
        where: {
          id: req.body.productId
        },
        // attributes: ['id', 'main_image', 'mrp'],
        raw: true
      });

      let batchData = {
        id: uuid(),
        batch_no: req.body.batchNo,
        mfg_date: new Date(req.body.mfgDate),
        exp_date: new Date(req.body.expDate),
        mrp: req.body.mrp,
        product_id: req.body.productId,
        product_image: productInfo?.main_image,
        createdBy: req.userId ? req.userId : null,
        mfg_loc_id: req.body.location ? req.body.location : null
      }
      await ProductBatchModel.create(batchData)

      console.log(">>>>>>>>>>>>>>batch DAta", batchData);

      res.status(200).send({ success: 1, message: message.productBatchAdd });
    } catch (ex) {
      console.log(ex);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },

  addRetailerBatch: async function (req, res) {
    try {
      let validator = new v(req.body, {
        product_id: 'required',
        batch_no: 'required',
        // mfg_date: 'required|date',
        exp_date: 'required|date',
        mrp: 'required|numeric|min:0',
        ptr: 'required|numeric|min:0',
        disc_percentage: 'required|numeric|min:0|max:100'
      });
      let matched = await validator.check();

      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      // console.log(">>>>>>>>>>>>>>>1");

      let retailerId = req.retailerId;
      let retail_Outlet_Id = req.retailOutletId;

      let retailOutletDetails = await models.retailerOutletsModels.findOne({
        where: {
          id: req.retailOutletId
        },
        raw: true
      })
      if (!retailOutletDetails) {
        // put some code in this
      }

      // console.log(">>>>>>>>>>>>>>>10");

      let dynamicRetailerBatchModel = await models.dynamicModel.getRetailerBatchModel(retailOutletDetails.table_uid);

      // Check if a batch with the same product_id and exp_date already exists
      const isExists = await dynamicRetailerBatchModel.findOne({
        where: {
          product_id: req.body.product_id,
          batch_no: req.body.batch_no,
        },
        raw: true
      });

      if (isExists) {
        return res.status(200).send({ success: 0, message: "Batch already exists!" });
      }

      console.log(">>>>>>>>>>>>>>>101");

      let productInfo = await Product.findOne({
        where: {
          id: req.body.product_id
        },
        // attributes: ['id', 'main_image', 'mrp'],
        raw: true
      });

      console.log(">>>>>>>>>>>>>>>1010");

      let retailerBatchData = {
        id: uuid(),
        retailer_id: retailerId,
        retail_outlet_id: retail_Outlet_Id,
        batch_no: req.body.batch_no,
        product_id: req.body.product_id,
        mfg_date: req.body.mfg_date ? new Date(req.body.mfg_date) : null,
        exp_date: new Date(req.body.exp_date),
        mrp: req.body.mrp,
        ptr: req.body.ptr,
        discount_percentage: req.body.disc_percentage,
        // rack_no: req.body.rack_no
      }
      await dynamicRetailerBatchModel.create(retailerBatchData)

      console.log(">>>>>>>>>>>>>>batch DAta", retailerBatchData);

      res.status(200).send({ success: 1, message: message.productBatchAdd, data: retailerBatchData });

    } catch (ex) {
      console.log(ex);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },

  updateRetailerBatch: async function (req, res) {
    try {
      let validator = new v(req.body, {
        productId: 'required',
        batchNo: 'required',
        mfgDate: 'required|date',
        expDate: 'required|date',
        mrp: 'required|numeric|min:0',
        ptr: 'required|numeric|min:0',
        discount_percentage: 'required|numeric|min:0|max:100'
      });
      let matched = await validator.check();

      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      console.log(">>>>>>>>>>>>>>>1");

      let retailerBatchId = req.params.retailerBatchId;

      let retailerId = req.retailerId;
      let retail_Outlet_Id = req.retailOutletId;

      let retailOutletDetails = await models.retailerOutletsModels.findOne({
        where: {
          id: req.retailOutletId
        },
        raw: true
      })
      if (!retailOutletDetails) {
        // put some code in this
      }

      // console.log(">>>>>>>>>>>>>>>10");

      let dynamicRetailerBatchModel = await models.dynamicModel.getRetailerBatchModel(retailOutletDetails.table_uid);

      console.log(">>>>>>>>>>>>>>>101");

      let productInfo = await Product.findOne({
        where: {
          id: req.body.productId
        },
        // attributes: ['id', 'main_image', 'mrp'],
        raw: true
      });

      console.log(">>>>>>>>>>>>>>>1010");

      let retailerBatchData = {

        batch_no: req.body.batchNo,
        product_id: req.body.productId,
        mfg_date: new Date(req.body.mfgDate),
        exp_date: new Date(req.body.expDate),
        mrp: req.body.mrp,
        ptr: req.body.ptr,
        discount_percentage: req.body.discount_percentage,
        // rack_no: req.body.rack_no
      }


      /////////////////////////////////////////////////////////////////////////////////////

      console.log('retailerBatchData>>>>>>>', retailerBatchData);
      const isUpdated = await dynamicRetailerBatchModel.update(retailerBatchData, {
        where: {
          id: retailerBatchId
        },
      });

      if (isUpdated < 1) {
        return res.status(200).send({ success: 0, message: "Batch details hasn't updated. " });
      }

      return res.status(200).send({ success: 1, message: "Batch details updated successfully." });
    } catch (ex) {
      console.error(ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },


  bulkAdd: async function (req, res) {
    try {
      let validator = new v(req.body, {
        products: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: validatorError });
      }

      let rejectedArray = [];

      let allProducts = JSON.parse(req.body.products);
      let headerName = {
        "product_name": "product_name",
        "batch_name": "batch_name",
        "mfg_date": "mfg_date",
        "expiry_date": "exp_date",
        "mrp": "mrp",
        "mfg_Location": "mfg_Location",
      };

      for (let element of allProducts) {
        console.log(element);
        let ele = {};
        let keys = Object.keys(element);
        console.log(">>> Keysss", keys);
        for (let key of keys) {
          if (key === 'mfg_date:' || key === 'exp_date:') {
            ele[headerName[key]] = moment(new Date(element[key])).format('MM/ DD/YYYY');
          } else {
            ele[headerName[key]] = element[key] != null ? element[key].toString() : "";
          }
        }
        console.log(">>> ele", ele);

        let batch_name = await ProductBatchModel.findOne({
          where: {
            batch_no: ele.batch_name,
          },
          raw: true
        });

        if (batch_name) {
          element.reason = "Batch Name already exists";
          rejectedArray.push(element);
        } else {

          // let productInfo = await Product.findOne({
          //   where: {
          //     sku: { [Op.iLike]: ele.product_name }
          //   },
          //   raw: true
          // });

          let productDetails = await models.productsModel.findOne({ where: { name: ele.product_name }, raw: true });
          if (productDetails) {
            ele.product_name = productDetails.id;
          }
          else {
            // Other blocks to be added
          }

          // if (!productInfo) {
          //   element.reason = "Product not exists";
          //   rejectedArray.push(element);
          // } else {

          // }

          console.log("on my way to call Add block");
          console.log("ele is called:");
          console.log(ele);
          console.log("ele is recieved");
          // console.log("req is called:", req);

          let response = await add(ele, req);
          return res.status(200).send({
            success: "1",
            message: "Batches are added successfully"
          });

          if (response.success == 0) {
            element.reason = response.message;
            rejectedArray.push(element);
          }
        }
      }

      if (rejectedArray.length > 0) {
        if (rejectedArray.length == allProducts.length) {
          return res.status(200).send({
            success: "0",
            message: `All materials are rejected due to some reasons`,
            data: rejectedArray
          });
        } else {
          return res.status(200).send({
            success: "0",
            message: `${allProducts.length - rejectedArray.length} ${allProducts.length - rejectedArray.length > 1 ? 'Materials are' : 'Material is'}  added and ${rejectedArray.length} rejected due to some error.`,
            data: rejectedArray
          });
        }
      }
    } catch (error) {
      console.log("error", error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: "Internal Server Error"
      });
    }
  },


  list: async (req, res) => {
    try {
      let whereClause = {};
      if ([3].includes(req.roleId)) {
        whereClause.location_id = req.locationId;
      }

      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }

      let retailBatchSchema = await models.dynamicModel.getRetailerBatchModel(req.tableUid);
      let data = await retailBatchSchema.findAll({
        where: whereClause,
        include: [
          {
            model: Product,
            raw: true,
            attributes: ['id', 'sku', 'name']
          },
        ],
        order: [['createdAt', 'DESC']],
        raw: true,
        nest: true
      })
      console.log(">>>>>>>>>>>>>>>>>>>>>>>>>hello mera bhai", data);
      return res.status(200).send({ success: 1, data: data });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },


}

function stringToDate(dateString) {
  let dateParts = dateString.split("-");
  return new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
}

function checkDateFormat(dateFormat, dateString) {
  return dateFormat.test(dateString);
}

function excelDateToJSDate(serial) {
  const excelEpoch = new Date(1900, 0, 1);
  const daysOffset = serial - 1;
  const date = new Date(excelEpoch.setDate(excelEpoch.getDate() + daysOffset));
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

async function add(req, res) {
  try {
    let validator = new v(req.body, {
      // mfg_date: 'required', 
      // exp_date: 'required',
      // product_id: 'required',
      // mrp: 'required',
      // location_id: 'required',
      // batch_name: 'required'
    });
    let matched = await validator.check();


    if (!matched) {
      let validatorError = await controllers.parseValidate(validator.errors);
      return res.status(200).send({ success: 0, message: validatorError });
    }

    let batchNo = req.batch_name;

    const isExists = await ProductBatchModel.count({
      where: {
        product_id: req.product_name,
        batch_no: {
          [Op.iLike]: batchNo
        }
      }
    });

    if (isExists > 0) {
      return res.send({ success: 0, message: "Batch already found!" });
    }

    let productInfo = await Product.findOne({
      where: {
        id: req.product_name
      },
      // attributes: ['id', 'main_image', 'mrp'],
      raw: true
    });

    let batchData = {
      id: uuid(),
      batch_no: req.batch_name,
      mfg_date: req.mfg_date,
      exp_date: req.exp_date,
      mrp: req.mrp,
      product_id: productInfo.id,
      product_image: productInfo?.main_image,
      createdBy: req.userId ? req.userId : null,
      location_id: req.location_id ? req.location_id : null
    };

    await ProductBatchModel.create(batchData);

    return {
      success: 1,
      message: "Product added successfully."
    };
  } catch (ex) {
    console.log(ex);
    controllers.logger.error(req, error.message);
    return res.status(500).send({
      success: 0,
      message: ex.message
    });
  }
}

module.exports = product_batch;

