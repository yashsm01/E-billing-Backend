var uuid = require('uuid');
const { Sequelize, DataTypes, where } = require('sequelize');
const v = require('node-input-validator');
const Op = Sequelize.Op;
const moment = require('moment');
// models
let models = require("./_models");
// controller
const parseValidate = require("../middleware/parseValidate");
const controllers = require("./_controller");


let retailerStockController = {
  stockListProductWise: async (req, res) => {
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

      let productStockModel = await models.dynamicModel.getProductStockModel(req.tableUid);
      let stocks = await productStockModel.findAll({
        where: whereClause,
        include: [
          {
            model: models.productsModel,
            attributes: ['id', 'name', 'category', 'content', 'salt', 'uom', 'unit_size'],
            as: 'products',
            raw: true,
            nest: true,

            include: [
              {
                model: models.categoryModel,
                attributes: ['id', 'name'],
                as: 'categories',
                raw: true,
                nest: true,
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']],
        raw: true,
        nest: true

      }
      );
      return res.status(200).send({ success: 1, data: stocks });
    } catch (error) {
      console.log(error);
      return res.status(500).send({ message: error.toString() });
    }
  },
  stockLocationDetailsbyPoId: async (req, res) => {
    try {
      let validator = new v(req.params, {
        id: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }

      let purchaseModel = await models.puchaseSchema(req.tableUid);

      let purchaseOrderDetails = await purchaseModel.purchaseOrderDetailModels.findAll({
        where: {
          po_id: req.params.id,
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId
        },
        attributes: ['batch_id', 'product_id', 'mrp', 'ptr', 'qty', 'discount_percentage', 'base_amount', 'final_amount'],
        raw: true
      });

      console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>helllo hello helllo helllo", purchaseOrderDetails);

      if (purchaseOrderDetails.length == 0) {
        return res.status(200).send({ success: 0, message: "Purchase Details Not Availbale" });
      }

      let batchList = purchaseOrderDetails.map(x => x.batch_id);
      let productList = purchaseOrderDetails.map(x => x.product_id);
      let stockSchema = await models.stockSchema(req.tableUid);
      let puchaseSchema = await models.puchaseSchema(req.tableUid);
      let retailBatchStock = await stockSchema.batchStockModels.findAll({
        where: {
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId,
          // product_id: { [Op.in]: productList },
          batch_id: { [Op.in]: batchList }
        },
        include: [
          {
            model: models.productsModel,
            attributes: ['id', 'name', 'category', 'mrp', 'hsn_code'],
            as: 'products',
            raw: true,
            nest: true
          },
          {
            model: stockSchema.retailBatchModels,
            attributes: ['id', 'batch_no', 'mrp', 'exp_date', 'ptr', 'discount_percentage'],
            as: 'product_batches',
            raw: true,
            nest: true
          },
          {
            model: models.RetailerModel,
            attributes: ['id', 'name'],
            as: 'retailers',
            raw: true,
            nest: true
          }

        ],
        raw: true,
        nest: true
      });


      if (retailBatchStock.length == 0) {
        return res.status(200).send({ success: 0, message: "Purchase Stock Detail Not Availbale" });
      }

      // Attach purchaseOrderDetails to the corresponding retailBatchStock entries
      retailBatchStock.forEach(stock => {
        // Find the corresponding purchase order details by matching product_id and batch_id
        stock.purchaseOrderDetails = purchaseOrderDetails.find(detail =>
          detail.product_id === stock.product_id && detail.batch_id === stock.batch_id
        );
      });


      return res.status(200).send({
        success: 1,
        data: retailBatchStock
      })


    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  getStockDetailbyqrCode: async (req, res) => {
    try {
      //------------------------- validation ------------------------
      let validator = new v(req.params, {
        qrCode: "required|maxLength:13",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }
      //gte decode code
      let { TUID, code, qrCode } = getDecodeQrCodes(req.params.qrCode);
      // Find the batch stock with the given QR code
      const stockSchema = await models.stockSchema(TUID);
      const batchStock = await stockSchema.batchStockModels.findOne({
        where: {
          qr_code: qrCode
        },
        include: [
          {
            model: models.productsModel,
            as: 'products',
            raw: true,
            nest: true
          },
          {
            model: stockSchema.retailBatchModels, // Include related batch details
            as: 'product_batches',
            raw: true,
            nest: true
          }
        ],
        raw: true,
        nest: true
      });
      // If no batch stock is found, return a message
      if (!batchStock) {
        return res.status(200).send({ success: 0, message: "No products found matching your search criteria." });
      };

      let productStock = await stockSchema.productStockModels.findOne({
        where: {
          retailer_id: batchStock?.retailer_id ?? null,
          retail_outlet_id: batchStock?.retail_outlet_id ?? null,
          product_id: batchStock.product_id,
        },
        raw: true
      });

      // If no batch stock is found, return a message
      if (!productStock) {
        return res.status(200).send({ success: 0, message: "No products found matching your search criteria." });
      }

      // Return the batch stock details along with associated product information
      return res.status(200).send({ success: 1, data: { product: batchStock.products, batch: batchStock.product_batches, product_stocks: productStock, batchStock: batchStock } });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
}
function getDecodeQrCodes(SC) {
  let qrCode = SC;
  let TUID = SC[1] + SC[3] + "_" + SC[5] + SC[7] + SC[10] + SC[11];
  let code = SC[0] + SC[2] + SC[4] + SC[6] + SC[8] + SC[9] + SC[12];
  // TUID = 1 3 5 7 10 11 
  // code = 0 2 4 6 8 9 12 
  return { TUID, code, qrCode };
}
module.exports = retailerStockController;