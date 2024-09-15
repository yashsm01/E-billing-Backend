const v = require("node-input-validator");
const sequelize = require("sequelize");
const { Op } = require("sequelize");;
const moment = require('./../helpers/moment-config');
const logger = require("../helpers/logger");
const parseValidate = require("../middleware/parseValidate");
const qrcodeController = require('../controllers/qr-codes-controller');
const DynamicModels = require('../models/dynamic_models');
const commonController = require("./../controllers/common");
const { locationModel, batchChildRequestModel } = require("./_models");
const { log } = require("winston");
const StorageBins = require("../models/").storage_bins;
const ProductModel = require("../models/").products;
const productBatches = require("../models/").product_batches;
const StockSummary = require("../models/").stock_summary;
const ProductBatchModel = require("../models/").product_batches;
const LocationModel = require("../models/").locations;
const ProductionOrderModel = require("../models/").production_orders;
const CompanyUser = require('../models/').company_users;
const PrimaryQrCodeParent = require('../models').primary_qrcode_parents;
const SecondaryQrCodeParent = require('../models').secondary_qrcode_parents;
const TertiaryQrCodeParent = require('../models').tertiary_qrcode_parents;
const OuterQrCodeParent = require('../models').outer_qrcode_parents;
const MappingTransactionModel = require('../models').mapping_transactions;
const ErpTransferModel = require('../models').erp_transfers;
const ReplacementHistory = require('../models').replacement_history;
const DynamicUIDModel = require('../models/').dynamic_uids;
const DynamicLevelCodesModel = require('../models/').dynamic_level_codes;
const Devices = require('../models/').devices;
const StockSummaryModel = require('../models/').stock_summary;
const StorageBinModel = require('../models/').storage_bins;
const BatchUploadChildRequest = require('../models/').batch_upload_child_request;
const OrderModel = require("../models/").orders;
const models = require("./_models");
const db = require('../models');

//Globle List
let statusList = require('../config/const').orderStatus;

StockSummaryModel.hasOne(LocationModel, {
  foreignKey: 'id',
  sourceKey: 'location_id'
});

StockSummaryModel.hasOne(ProductModel, {
  foreignKey: 'id',
  sourceKey: 'product_id'
});

StockSummaryModel.hasOne(productBatches, {
  foreignKey: 'id',
  sourceKey: 'batch_id'
});

BatchUploadChildRequest.hasOne(LocationModel, {
  foreignKey: 'id',
  sourceKey: 'location_id'
});

BatchUploadChildRequest.hasOne(ProductModel, {
  foreignKey: 'id',
  sourceKey: 'product_id'
});

BatchUploadChildRequest.hasOne(productBatches, {
  foreignKey: 'id',
  sourceKey: 'batch_id'
});

let exportLimit = 300000;

//NEW STOCK REPORT
let stock_report = {
  getList: async (req, res) => {
    try {
      let validator = new v(req.query, {
        location_id: "required"
      });
      let matched = await validator.check();

      if (!matched) {
        let validatorError = parseValidate(validator.errors)
        return res.status(200).send({ success: "0", message: validatorError });
      }
      // let locationId;
      // if(req.roleId!=1 && req.roleId!=2){
      //     locationId = req.headers["locationId"]
      // }else if(!matched){
      //   return res.status(200).send({success:0,message:'Location ID is Required'})
      // }else{
      locationId = req.query.location_id
      // }

      let location_detail = await LocationModel.findOne({
        where: {
          id: locationId
        },
        raw: true,
        attributes: ['unique_name']
      })
      if (!location_detail) {
        return res.status(200).send({ success: 0, message: 'Location Not Found' })
      }
      //get storage bins of location
      let storage_bins = await storageBins.findAll({
        where: {
          location_id: locationId
        },
        raw: true,
        attributes: ['id', 'name']
      });
      if (storage_bins.length == 0) {
        return res.status(200).send({ success: 0, message: 'Storage bins not found at selected location' });
      }
      let storage_bin_id = await storage_bins.map(bin => { return bin.id });

      //get all products
      let all_products = await ProductModel.findAll({
        raw: true,
        attributes: ['sku', 'u_id']
      });

      let stock = [];
      for (let product of all_products) {
        let product_uid = product.u_id;
        let table_id = "trusted_qrcodes_" + product_uid.toLowerCase();
        let trusted_qrcode = require("../models/")[table_id];

        trusted_qrcode.belongsTo(storageBins, { foreignKey: "storagebin_id" });
        storageBins.hasMany(trusted_qrcode, { foreignKey: "storagebin_id" });
        let product_stock = await trusted_qrcode.findAll({
          where: {
            storagebin_id: { [Op.in]: storage_bin_id },
            is_deleted: false
          },
          include: [
            {
              model: storageBins,
              attributes: ["name", "id"]
            }
          ],
          attributes: [
            [sequelize.fn("COUNT", "storagebin_id"), "count"],
            "storagebin_id",
            "storage_bin.id"
          ],
          group: ["storagebin_id", "storage_bin.id"],
          raw: true,
          nest: true
        });
        for (let data of product_stock) {
          let obj = {
            sku: product.sku,
            units: data.count,
            storagebin: data.storage_bin
          }
          stock.push(obj);
        }
      }
      return res.status(200).send({ success: '1', data: stock, location: location_detail.unique_name })


    }
    catch (error) {
      logger.error(req, error.message);
      console.log("error in stock get List", error);
      res.status(500).send({ success: 0, message: "Some Internal Error" });
    }
  },

  detailedStockList: async (req, res) => {
    try {
      let validator = new v(req.query, {
        sku: "required",
        storagebin_id: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: 0, message: validator.errors });
      }
      let product_details = await ProductModel.findOne({
        where: {
          sku: req.query.sku
        },
        attributes: ['id', 'sku', 'u_id'],
        raw: true
      });

      let product_uid = product_details.u_id;
      let table_id = "trusted_qrcodes_" + product_uid.toLowerCase();
      let trusted_qrcode = require("../models/")[table_id];
      trusted_qrcode.belongsTo(storageBins, { foreignKey: "storagebin_id" });
      storageBins.hasMany(trusted_qrcode, { foreignKey: "storagebin_id" });

      trusted_qrcode.belongsTo(productBatches, { foreignKey: "batch_id" });
      productBatches.hasMany(trusted_qrcode, { foreignKey: "batch_id" });
      let product_stock = await trusted_qrcode.findAll({
        where: { storagebin_id: req.query.storagebin_id },
        include: [
          {
            model: storageBins,
            attributes: ["name", "id"]
          },
          {
            model: productBatches,
            attributes: ["batch_no", "id", "manufacturing_date"]
          }
        ],
        attributes: [
          [sequelize.fn("COUNT", "batch_id"), "batch_count"],
          "batch_id",
          "storage_bin.id",
          "product_batch.id"
        ],
        group: ["batch_id", "storage_bin.id", "product_batch.id"],
        raw: true,
        nest: true
      });

      return res.status(200).send({ success: '1', data: product_stock });
    }
    catch (error) {
      logger.error(req, error.message);
      console.log("error in stock get batch List", error);
      res.status(500).send({ success: 0, message: "Some Internal Error" });
    }
  },

  stockListByProduct: async (req, res) => {
    try {
      let validator = new v(req.query, {
        locationId: "required",
        productId: "required",
        batchId: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }


      let stockDetails = await StockSummary.findAll({
        where: {
          location_id: req.query.locationId,
          product_id: req.query.productId,
          batch_id: req.query.batchId
        },
        include: [
          {
            model: StorageBins,
            raw: true,
            as: 'bin',
            attributes: ["name", "id"]
          }
        ],
        order: [['packaging_level', 'ASC'], ['storage_bin', 'ASC']],
        raw: true,
        nest: true
      })

      return res.status(200).send({ success: '1', data: stockDetails });
    }
    catch (error) {
      logger.error(req, error.message);
      console.log("error in stock get batch List", error);
      res.status(500).send({ success: 0, message: "Some Internal Error" });
    }
  },

  exportTransactionReport: async (req, res) => {
    try {
      let validator = new v(req.body, {
        transactionType: "required",
        fromDate: "required",
        toDate: "required",
        locationId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      console.log("req.body", req.body);

      /* transactinType: 
          1 code generation
          3 Non QR to QR

          exportType:
          2 QTY
      */

      if (req.body.transactionType == 1) {
        if (req.body.exportType == 1 || req.body.exportType == 2) {
          await codeGenerationQTYReport(req, res)
        } else {
          res.status(200).send({ success: 0, message: "Invalid Export Type" })
        }
      }
      else if (req.body.transactionType == 2 || req.body.transactionType == 3) {
        await mappingTransactionReport(req, res);
      }
      else if (req.body.transactionType == 4) {
        if (req.body.exportType == 1) {
          await replacementReport(req, res, req.body.exportType)
        }
        else if (req.body.exportType == 2) {
          // await mappingTransactionReport(req, res, true)
          await replacementReport(req, res, req.body.exportType)
        }
        else if (req.body.exportType == 3) {
          await replacementReport(req, res, req.body.exportType)
        }
        else {
          return res.status(200).send({ success: 0, message: "Invalid Export Type" })
        }
      }
      else {
        return res.status(200).send({ success: 0, message: "Invalid Transaction Type" })
      }
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },

  exportStockReport: async (req, res) => {
    try {
      let validator = new v(req.body, {
        productId: "required",
        batchId: "required",
        packagingLevel: "required|in:P,S,T,O",
        storageBinId: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let productInfo = await ProductModel.findOne({
        where: {
          id: req.body.productId,
          is_general: false
        },
        raw: true
      })

      if (!productInfo) {
        return res.status(200).send({ success: 0, message: "Item Not Found" })
      }

      let generalProduct = await ProductModel.findOne({
        where: {
          is_general: true
        },
        raw: true
      })

      if (!generalProduct) {
        return res.status(200).send({ success: 0, message: "General Item Not Found" })
      }

      let batchInfo = await ProductBatchModel.findOne({
        where: {
          id: req.body.batchId
        },
        raw: true
      })

      if (!batchInfo) {
        return res.status(200).send({ success: 0, message: "Batch Not Found" })
      }

      // let where


      let CustomModel = await getDynamicModel(req.body.packagingLevel, productInfo.u_id)

      let stock = await CustomModel.findAll({
        where: {
          batch_id: req.body.batchId,
          storage_bin_id: req.body.storageBinId,
          is_replaced: false,
          [Op.or]: [
            { is_mapped: true },
            { is_active: true },
          ]
        },
        raw: true
      })
      console.log("Stock Found::", productInfo.u_id, stock.length);


      let CustomModel2 = await getDynamicModel(req.body.packagingLevel, generalProduct.u_id)
      let generalStock = await CustomModel2.findAll({
        where: {
          batch_id: req.body.batchId,
          storage_bin_id: req.body.storageBinId,
          is_replaced: false,
          [Op.or]: [
            { is_mapped: true },
            { is_active: true },
          ],
        },
        raw: true
      })

      console.log("General Stock::", generalProduct.u_id, generalStock.length);

      let allStock = [...stock, ...generalStock]

      console.log("All Stock::", allStock.length);
      let data = [];

      for (let element of allStock) {
        let obj = {
          "QR Code": element.qr_code,
          "UID": element.unique_code,
          "Item Code": productInfo.sku,
          "Batch No.": batchInfo.batch_no,
          "Mfg. Date": moment(new Date(batchInfo.mfg_date)).tz("Asia/Kolkata").format('DD/MMM/YYYY').toUpperCase(),
          "Exp. Date": moment(new Date(batchInfo.exp_date)).tz("Asia/Kolkata").format('DD/MMM/YYYY').toUpperCase(),
          "Indicator": req.body.packagingLevel,
          "Code Type": element.parent_id ? element.is_open ? 'Open' : element.is_general ? 'General' : 'Specific' : 'Previous Code',
        }
        data.push(obj)
      }

      if (data.length == 0) {
        return res.status(200).send({ success: 0, message: "No Details To Export" })
      }
      let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm');
      let fileName = `${productInfo.sku}_${batchInfo.batch_no}_${req.body.packagingLevel}_${data.length}_${dateString}.xlsx`
      return res.status(200).send({ success: 1, fileName: fileName, data: data })

    } catch (error) {
      logger.error(req, error.message);
      console.log(error);
      res.status(500).send({ success: 0, message: "Some Internal Error" });
    }
  },

  exportErpSyncReport: async (req, res) => {
    try {
      let validator = new v(req.body, {
        transactionType: "required",
        fromDate: "required",
        toDate: "required",
        locationId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      console.log("req.body", req.body);

      /* transactinType: 
          1 PO Received
          2 PO Sent

          exportType:
          1 UID
          2 QTY
      */

      if (req.body.transactionType == 1) {
        if (req.body.exportType == 1) {
          await poReceivedErpSyncReport(req, res);
        } else if (req.body.exportType == 2) {
          await poReceivedErpSyncReport(req, res);
        } else {
          return res.status(200).send({ success: 0, message: "Invalid Export Type" })
        }
      }
      else if (req.body.transactionType == 2) {
        if (req.body.exportType == 1) {
          await poSentErpSyncReport(req, res);
        } else if (req.body.exportType == 2) {
          await poSentErpSyncReport(req, res);
        } else {
          return res.status(200).send({ success: 0, message: "Invalid Export Type" })
        }
      } else {
        return res.status(200).send({ success: 0, message: "Invalid Transaction Type" })
      }
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },

  exportInventoryReport: async (req, res) => {
    try {
      let validator = new v(req.body, {
        locationId: "required",
        // productId: "required",
        // batchId: "required",
        //packagingLevel: "required|in:P,S,T,O",
        exportType: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      if (req.body.exportType == 1) {
        if (['P', 'S', 'T'].includes(req.body.packagingLevel) && (!req.body.productId || !req.body.batchId)) {
          return res.status(200).send({ success: 0, message: "Item And Batch Required" })
        }
      }


      console.log("req.body", req.body);
      if (req.body.exportType == 1) {
        await inventoryReportUIDAndQty(req, res);
      } else if (req.body.exportType == 2) {
        await inventoryReportUIDAndQty(req, res);
      } else {
        return res.status(200).send({ success: 0, message: "Invalid Export Type" })
      }
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },

  exportProductionReport: async (req, res) => {
    try {
      let validator = new v(req.body, {
        productId: "required",
        batchId: "required",
        locationId: "required",
        startDate: "required",
        endDate: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let startDate = moment(req.body.startDate, "DD/MM/YYYY").format("YYYY-MM-DD") + " 00:00:00";
      let endDate = moment(req.body.endDate, "DD/MM/YYYY").format("YYYY-MM-DD") + " 23:59:59";

      let fileName = "";
      let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm')
      fileName = fileName + '_' + dateString + '.xlsx';
      let productIds = req.body.productId.map(x => x.item_id);
      let batchIds = req.body.batchId.map(x => x.item_id);
      let locationIds = req.body.locationId.map(x => x.id);

      console.log("All loc Ids>>>>>>", locationIds);

      batchChildRequestModel.belongsTo(productBatches, { foreignKey: "batch_id" });
      productBatches.hasMany(batchChildRequestModel, { foreignKey: "batch_id" });

      batchChildRequestModel.belongsTo(locationModel, { foreignKey: "location_id" });
      locationModel.hasMany(batchChildRequestModel, { foreignKey: "location_id" });

      batchChildRequestModel.belongsTo(ProductModel, { foreignKey: "product_id" });
      ProductModel.hasMany(batchChildRequestModel, { foreignKey: "product_id" });

      let stocksummaryList = await BatchUploadChildRequest.findAll({
        where: {
          location_id: locationIds,
          [Op.and]: [
            { createdAt: { [Op.gte]: startDate } },
            { createdAt: { [Op.lte]: endDate } },
            { product_id: { [Op.in]: productIds } },
            { batch_id: { [Op.in]: batchIds } },
            { inserted_counts: { [Op.gte]: 1 } }
          ],

        },

        include: [
          {
            model: LocationModel,
            attributes: ["id", "name"],
            nest: true,
            raw: true
          },
          {
            model: ProductModel,
            attributes: ["id", "name"],
            nest: true,
            raw: true
          },
          {
            model: productBatches,
            attributes: ["id", "batch_no", "size"],
            nest: true,
            raw: true
          },

        ],

        attributes: ['location.id', 'product.id', 'product_batch.id', 'product_batch.batch_no', 'product_batch.size', 'level',
          [sequelize.fn('SUM', sequelize.col('inserted_counts')), 'inserted_counts']],

        group: ['location.id', 'product.id', 'product.name', 'product_batch.id', 'product_batch.batch_no', 'product_batch.size', 'level'],

        raw: true,
        nest: true
      });
      console.log(">>>>>>>>startDate", startDate, ">>>>>>>>endDate", endDate);
      console.log(">>>>>>>>>>>>>>>stocksummaryList", stocksummaryList.length);

      if (stocksummaryList.length == 0) {
        return res.status(200).send({ success: 0, message: "No Data Available" })
      }
      let level = {
        "P": "Primary",
        "S": "Secondary",
        "T": "Tertiary",
        "O": "Outer"
      }
      let data = stocksummaryList.map(x => {
        return {
          "Location Id": x.location.unique_name,
          "Location Name": x.location.name,
          "Product Name": x.product.name,
          "Batch No": x.product_batch.batch_no,
          // "Batch size": x.product_batch.size,
          "Packaging Level": level[x.level],
          "Mapped count": x.inserted_counts
          // "Date & Time": moment(x.createdAt).format("YYYY-MM-DD HH:mm")
        }
      })


      return res.status(200).send({ success: 1, message: "", data: data, fileName })
    } catch (error) {
      console.log("Sanjay>>>>", error);
      logger.error(req, error.message);

      return res.status(500).send({ message: error.toString() });
    }
  },
  exportCodeGenerationReport: async (req, res) => {
    try {
      let validator = new v(req.body, {
        startDate: "required",
        endDate: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let startDate = moment(req.body.startDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 00:00:00";
      let endDate = moment(req.body.endDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 23:59:59";

      let fileName = "";

      let start = moment(req.body.startDate, "YYYY-MM-DD").format("DD-MMM-YY");
      let end = moment(req.body.endDate, "YYYY-MM-DD").format("DD-MMM-YY");
      fileName = fileName + '_' + `From_"${start}_To_"${end}"` + '.xlsx';

      let productList = await models.productsModel.findAll({ attributes: ['id', 'sku', 'name', 'is_general'], raw: true });
      let locationList = await models.locationModel.findAll({ where: { is_customer: false }, attributes: ['id', 'unique_name', 'name'], raw: true });

      let codeGenerationList = await models.productionOrdersModel.findAll({
        where: {
          [Op.and]: [
            { createdAt: { [Op.gte]: startDate } },
            { createdAt: { [Op.lte]: endDate } }
          ],
        },
        attributes: [
          'location_id',
          'product_id',
          [sequelize.fn('SUM', sequelize.cast(sequelize.col('primary_codes'), 'numeric')), 'primary_codes'],
          [sequelize.fn('SUM', sequelize.cast(sequelize.col('secondary_codes'), 'numeric')), 'secondary_codes'],
          [sequelize.fn('SUM', sequelize.cast(sequelize.col('tertiary_codes'), 'numeric')), 'tertiary_codes'],
          [sequelize.fn('SUM', sequelize.cast(sequelize.col('outer_codes'), 'numeric')), 'outer_codes'],
        ],
        group: ['location_id', 'product_id'],
        order: ['location_id', 'product_id'],
        nest: true,
        raw: true
      });

      if (codeGenerationList.length == 0) {
        return res.status(200).send({ success: 0, message: "No Data Available" })
      }

      let generalCodesList = [];
      let GeneralProduct = productList.filter(x => x.is_general == true);
      let genList = GeneralProduct.map(x => x.id);
      for (let index = 0; index < locationList.length; index++) {
        const element = locationList[index];
        let primaryGeneralCodes = await models.primaryQrcodeParentModel.findAll({
          where: {
            [Op.and]: [
              { createdAt: { [Op.gte]: startDate } },
              { createdAt: { [Op.lte]: endDate } },
              { location_id: element.id },
              { product_id: { [Op.in]: genList } },
              { is_general: true }
            ],
          },
          attributes: [
            'product_id',
            [sequelize.fn('SUM', sequelize.cast(sequelize.col('total_qrcode'), 'numeric')), 'total_qrcode'],
          ],
          group: ['product_id'],
          order: ['product_id'],
          nest: true,
          raw: true
        });

        let secondaryGeneralCodes = await models.secondaryQrcodeParentModel.findAll({
          where: {
            [Op.and]: [
              { createdAt: { [Op.gte]: startDate } },
              { createdAt: { [Op.lte]: endDate } },
              { location_id: element.id },
              { product_id: { [Op.in]: genList } },
              { is_general: true }
            ],
          },
          attributes: [
            'product_id',
            [sequelize.fn('SUM', sequelize.cast(sequelize.col('total_qrcode'), 'numeric')), 'total_qrcode'],
          ],
          group: ['product_id'],
          order: ['product_id'],
          nest: true,
          raw: true
        });

        let tertiaryGeneralCodes = await models.tertiaryQrcodeParentsModel.findAll({
          where: {
            [Op.and]: [
              { createdAt: { [Op.gte]: startDate } },
              { createdAt: { [Op.lte]: endDate } },
              { location_id: element.id },
              { product_id: { [Op.in]: genList } },
              { is_general: true }
            ],
          },
          attributes: [
            'product_id',
            [sequelize.fn('SUM', sequelize.cast(sequelize.col('total_qrcode'), 'numeric')), 'total_qrcode'],
          ],
          group: ['product_id'],
          order: ['product_id'],
          nest: true,
          raw: true
        });

        let outerGeneralCodes = await models.outerQrcodeParentModel.findAll({
          where: {
            [Op.and]: [
              { createdAt: { [Op.gte]: startDate } },
              { createdAt: { [Op.lte]: endDate } },
              { location_id: element.id },
              { product_id: { [Op.in]: genList } },
              { is_general: true }
            ],
          },
          attributes: [
            'product_id',
            [sequelize.fn('SUM', sequelize.cast(sequelize.col('total_qrcode'), 'numeric')), 'total_qrcode'],
          ],
          group: ['product_id'],
          order: ['product_id'],
          nest: true,
          raw: true
        });
        if ((primaryGeneralCodes.length > 0 ||
          secondaryGeneralCodes.length > 0 ||
          tertiaryGeneralCodes.length > 0 ||
          outerGeneralCodes.length > 0)) {
          generalCodesList.push({
            location_id: element.id,
            product_id: GeneralProduct[0].id,
            primary_codes: primaryGeneralCodes[0]?.total_qrcode ?? 0,
            secondary_codes: secondaryGeneralCodes[0]?.total_qrcode ?? 0,
            tertiary_codes: tertiaryGeneralCodes[0]?.total_qrcode ?? 0,
            outer_codes: outerGeneralCodes[0]?.total_qrcode ?? 0
          })
        }
      }

      let GeneralProductCodes = {
        "P": "Primary",
        "S": "Secondary",
        "T": "Tertiary",
        "O": "Outer"
      }
      let TotalList = [...codeGenerationList, ...generalCodesList];
      let data = TotalList.map(x => {
        return {
          "Location ID": locationList.filter(y => y.id == x.location_id)[0].unique_name,
          "Location Name": locationList.filter(y => y.id == x.location_id)[0].name,
          "Product Name": productList.filter(y => y.id == x.product_id)[0].sku,
          "Primary": Number(x.primary_codes),
          "Secondary": Number(x.secondary_codes),
          "Tertiary": Number(x.tertiary_codes),
          "Outer": Number(x.outer_codes),
          "Total": Number(x.primary_codes) + Number(x.secondary_codes) + Number(x.tertiary_codes) + Number(x.outer_codes)
        }
      })

      data.sort((a, b) => {
        if (a['Location Name'] < b['Location Name']) {
          return -1;
        } else if (a['Location Name'] > b['Location Name']) {
          return 1;
        } else {
          // If name1 is equal, compare by name2
          if (a['Product Name'] < b['Product Name']) {
            return -1;
          } else if (a['Product Name'] > b['Product Name']) {
            return 1;
          } else {
            return 0;
          }
        }
      });


      return res.status(200).send({ success: 1, message: "", data: data, fileName })
    } catch (error) {
      console.log("Sanjay>>>>", error);
      logger.error(req, error.message);

      return res.status(500).send({ message: error.toString() });
    }
  },

  exportSupplyChainReport: async (req, res) => {
    try {
      console.log("req.body", req.body);
      let validator;

      if (req.body.transactionType == 1 || req.body.transactionType == 2 || req.body.transactionType == 3 || req.body.transactionType == 5) {
        validator = new v(req.body, {
          transactionType: "required",
          fromDate: "required",
          toDate: "required",
          fromLocationId: "required",
          toLocationId: "required",
        });
      } else if (req.body.transactionType == 4) {
        validator = new v(req.body, {
          transactionType: "required",
          locationId: "required",
        });
      }

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      /* transactinType: 
          
          1 Stock Outward
          2 Stock Outward
          3 Sales Return
          4 Inventory Report
          5 Sales Order
      */

      if (req.body.transactionType == 1) {
        await stockOutwardReport(req, res);
      } else if (req.body.transactionType == 2) {
        await stockInwartdReport(req, res);
      } else if (req.body.transactionType == 3) {
        await salesReturnReport(req, res);
      } else if (req.body.transactionType == 4) {
        await InventoryReport(req, res);
      } else if (req.body.transactionType == 5) {
        await salesOrderReport(req, res);
      } else {
        return res.status(200).send({ success: 0, message: "Invalid Transaction Type" })
      }

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }

  },

  schemeUserResponse: async (req, res) => {
    try {
      let validator = new v(req.body, {
        id: "required",
        // start: "required",
        // end: "required"
        // filterType: "required"
      });
      // console.log("body",req.body)
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let staratDate;
      let endDate;
      if (req.body.start) {
        staratDate = req.body.start;
      }

      if (req.body.end) {
        endDate = req.body.end;
      }
      let pointAllocationScheme = await models.pointAllocationModel.findOne({
        where: {
          id: req.body.id
        },
        raw: true
      });

      console.log("points allocation >>>>", pointAllocationScheme)

      if (!pointAllocationScheme) {
        return res.status(200).send({ success: 0, message: "Scheme Detail Not Found" });
      }
      let start = req.body.start ?? '2023-01-10';
      let end = req.body.end ?? '2023-12-31';
      // let filterType = req.body.filterType ?? 'w';
      //3 year Limit
      if (new Date(end).getTime() - new Date(end).getTime(start) > 1000 * 60 * 60 * 25 * 365 * 3) {
        return res.status(200).send({ success: 0, message: "Date Filter Limit Is 3 Years..." });
      }
      const currentDate = new Date();
      // if (filterType == 'w') {
      //   start = moment(new Date().setDate(new Date().getDate() - 35)).format("YYYY-MM-DD");
      //   end = moment(new Date()).format("YYYY-MM-DD");
      // } else if (filterType == 'm') {
      //   end = moment(new Date()).format("YYYY-MM-DD");
      //   start = moment(new Date().setMonth(new Date().getMonth() - 5)).format("YYYY-MM-DD");
      // } else if (filterType == 'y') {
      //   end = moment(new Date()).format("YYYY-MM-DD");
      //   start = moment(new Date().setFullYear(new Date().getFullYear() - 4)).format("YYYY-MM-DD");
      // } else if (filterType == 'c') {

      // }

      // let duration = {
      //   'w': 'weekly',
      //   'm': 'monthly',
      //   'y': 'yearly',
      //   'd': 'daily',
      //   'c': 'daily'
      // }
      // let filters = generateFilteredDates(new Date(start), new Date(end), duration[`${filterType}`]);
      // let filteredDates = filters.filteredDates;
      // let filterMonths = filters.filterMonths;

      //get Available customer_products_MM_YY Tables
      let tableListQuery = `SELECT table_name FROM information_schema.tables WHERE table_name like 'customer_products_%'`;
      // filterMonths.forEach(element => {
      //   tableListQuery += `'customer_products_${element}',`;
      // });
      // tableListQuery = tableListQuery.slice(0, -1);
      // tableListQuery += ')';

      let availableTable = await querySQl(tableListQuery);

      let tableList = availableTable.map(x => {
        return x.substr(x.length - 5);
      })

      console.log("all tables>", tableList)

      let registoreProductList = [];
      //get count Sku Wize 
      // for (let j = 0; j < pointAllocationScheme.length; j++) {
      //   const SKU = pointAllocationScheme.sku_id[j];
      // let ProductDetail = await models.productsModel.findOne({
      //   where: {
      //     id: SKU
      //   },
      //   attributes: ['id', 'sku', 'name'],
      //   raw: true
      // });
      for (let y = 0; y < tableList.length; y++) {
        const element = tableList[y];
        let customerProductScheme = await DynamicModels.getCustomerProductsModel(element);
        let list = await customerProductScheme.findAll({
          where:
          {
            // product_id: ProductDetail.id,
            scheme_id: { [Op.overlap]: [pointAllocationScheme.id] },
            // createdAt: {
            //   [Op.between]: [start, end],
            // },
          },
          // attributes: ["city_id"],
          raw: true
        });
        registoreProductList.push(...list);
      }
      // };

      if (registoreProductList.length == 0) {
        return res.status(200).send({ success: 1, message: "Data not available", data: [] });
      }

      let level = {
        "P": "Primary",
        "S": "Secondary",
        "T": "Tertiary",
        "O": "Outer"
      };

      let consumerTypes = {
        "0": "Farmer",
        "1": "Dealer",
        // "2": "Wholesaler",
        "3": "Retailer"
      }

      // find user info
      let userRegisterReportData = [];
      for (let i = 0; i < registoreProductList.length; i++) {
        let consumerId = registoreProductList[i].customer_id;
        let roleId = registoreProductList[i].role_id;
        let isRewardClaimed = registoreProductList[i].is_reward_claimed ? "Yes" : "No";
        let productLevel = level[registoreProductList[i].level];
        let points = isRewardClaimed ? registoreProductList[i].points : "Pending";
        let uniqueCode = registoreProductList[i].unique_code;

        let userInfo = {};
        if (roleId == 0) {
          // farmer info 
          userInfo = await models.ConsumersModel.findOne({
            where: { id: consumerId },
            attributes: ['name', 'phone', 'email',],
            // include: [{
            //   model: models.cityModel,
            //   attributes: ["district_id"],
            //   raw: true,
            //   nest: true,
            // }],
            raw: true
          });
        } else {
          userInfo = await models.ChannelPartners.findOne({
            where: { id: consumerId },
            attributes: ['name', 'phone', 'email',],
            // include: [{
            //   model: models.cityModel,
            //   attributes: ["district_id"],
            //   raw: true,
            //   nest: true,
            // }],
            raw: true
          })
        }

        if (!userInfo) {
          console.log("User Info Not found>>>>>>>");
          continue;
        }

        userRegisterReportData.push(
          {
            "Scheme Name": pointAllocationScheme.name,
            "Consumer Type": consumerTypes[roleId],
            "Consumer Name": userInfo.name,
            "Consumer Phone No": userInfo.phone,
            "Consumer Email Id ": userInfo.email,
            "Unique Code": uniqueCode,
            "Code Level": productLevel,
            "Card Scratched": isRewardClaimed,
            "Rewarded Points": points,
            "Date": moment(registoreProductList.createdAt).format("YYYY-MM-DD")
          }
        );

        console.log("userRegisterReportData>>>>>>>>", userRegisterReportData);
      }

      console.log("final info Obj>>>>>>>>", userRegisterReportData)

      let date = moment(new Date()).format("YYYY-MM-DD");
      let fileTitle = pointAllocationScheme.name.replace(/ /g, '_');
      let fileName = `${fileTitle}_${date}.xlsx`;
      return res.status(200).send({ success: 1, message: "get data success", data: userRegisterReportData, fileName: fileName });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },

  luckyDrawUserResponse: async (req, res) => {
    try {
      let validator = new v(req.body, {
        id: "required",
      });
      console.log("body", req.body)
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let staratDate;
      let endDate;
      if (req.body.start) {
        staratDate = req.body.start;
      }

      if (req.body.end) {
        endDate = req.body.end;
      }
      let luckyDrawScheme = await models.LuckyDrawModel.findOne({
        where: {
          id: req.body.id
        },
        raw: true
      });

      console.log("luckyDrawScheme >>>>", luckyDrawScheme)

      if (!luckyDrawScheme) {
        return res.status(200).send({ success: 0, message: "Scheme Detail Not Found" });
      }
      let start = req.body.start ?? '2023-01-10';
      let end = req.body.end ?? '2023-12-31';

      //3 year Limit
      if (new Date(end).getTime() - new Date(end).getTime(start) > 1000 * 60 * 60 * 25 * 365 * 3) {
        return res.status(200).send({ success: 0, message: "Date Filter Limit Is 3 Years..." });
      }
      const currentDate = new Date();

      //get Available customer_products_MM_YY Tables
      let tableListQuery = `SELECT table_name FROM information_schema.tables WHERE table_name like 'lucky_draw_users_%'`;
      // filterMonths.forEach(element => {
      //   tableListQuery += `'customer_products_${element}',`;
      // });
      // tableListQuery = tableListQuery.slice(0, -1);
      // tableListQuery += ')';

      let availableTable = await querySQl(tableListQuery);

      let tableList = availableTable.map(x => {
        return x.substr(x.length - 5);
      })

      console.log("all tables>", tableList)

      let registoreProductList = [];
      //get count Sku Wize 
      // for (let j = 0; j < luckyDrawScheme.skus.length; j++) {
      //   const SKU = luckyDrawScheme.skus[j];

      for (let y = 0; y < tableList.length; y++) {
        const element = tableList[y];
        console.log("scheme id>>>>>>>>>>", luckyDrawScheme.id)
        console.log("table-----------", element, "--------------");
        let customerProductScheme = await DynamicModels.luckyDrawUsersModel(element);
        console.log("model-------------", customerProductScheme, "--------------");
        let list = await customerProductScheme.findAll({
          where:
          {
            // product_id: ProductDetail.id,
            scheme_id: luckyDrawScheme.id,
            // createdAt: {
            //   [Op.between]: [start, end],
            // },
          },
          // attributes: ["city_id"],
          raw: true
        });
        registoreProductList.push(...list);
      }
      // };

      if (registoreProductList.length == 0) {
        return res.status(200).send({ success: 1, message: "Data not available", data: [] });
      }

      console.log("user data>>>>>", registoreProductList);
      // return;
      let level = {
        "P": "Primary",
        "S": "Secondary",
        "T": "Tertiary",
        "O": "Outer"
      };

      let consumerTypes = {
        "0": "Farmer",
        "1": "Dealer",
        // "2": "Wholesaler",
        "3": "Retailer"
      }

      // find user info
      console.log("uinfo?", registoreProductList);

      let userRegisterReportData = [];
      for (let i = 0; i < registoreProductList.length; i++) {
        let consumerId = registoreProductList[i].customer_id;
        let roleId = luckyDrawScheme.consumer_type;
        console.log("Role Id aaya >>>>>>", roleId);
        // let isRewardClaimed = registoreProductList[i].is_reward_claimed ? "Yes" : "No";
        // let productLevel = level[registoreProductList[i].level];
        // let points = isRewardClaimed ? registoreProductList[i].points : "Pending";
        // let uniqueCode = registoreProductList[i].unique_code;

        let userInfo = {};
        if (roleId == 0) {
          // farmer info 
          userInfo = await models.ConsumersModel.findOne({
            where: { id: consumerId },
            attributes: ['name', 'phone', 'email',],
            // include: [{
            //   model: models.cityModel,
            //   attributes: ["district_id"],
            //   raw: true,
            //   nest: true,
            // }],
            raw: true
          });
        } else {
          userInfo = await models.ChannelPartners.findOne({
            where: { id: consumerId },
            attributes: ['name', 'phone', 'email',],
            // include: [{
            //   model: models.cityModel,
            //   attributes: ["district_id"],
            //   raw: true,
            //   nest: true,
            // }],
            raw: true
          })
        }

        if (!userInfo) {
          console.log("User Info Not found>>>>>>>");
          continue;
        }

        console.log(roleId, " consumerTypes[roleId]", consumerTypes[roleId])
        console.log("registoreProductList.reward_id>>>>>>>>>>>>>>>>>>", registoreProductList[i].reward_id)
        userRegisterReportData.push(
          {
            "Scheme Name": luckyDrawScheme.draw_name,
            "Consumer Type": consumerTypes[roleId],
            "Consumer Name": userInfo.name,
            "Consumer Phone No": userInfo.phone,
            "Consumer Email Id ": userInfo.email,
            "Rewarded": registoreProductList[i].reward_id != null && registoreProductList[i].reward_id != undefined ? "Yes" : "No",
            "Date": moment(registoreProductList.createdAt).format("YYYY-MM-DD")
            // "Unique Code": uniqueCode,
            // "Code Level": productLevel,
            // "Card Scratched": isRewardClaimed,
            // "Rewarded Points": points
          }
        );

        // console.log("userRegisterReportData>>>>>>>>",userRegisterReportData);
      }

      console.log("final info Obj>>>>>>>>", userRegisterReportData)

      let date = moment(new Date()).format("YYYY-MM-DD");
      let fileTitle = luckyDrawScheme.draw_name.replace(/ /g, '_');
      let fileName = `${fileTitle}_${date}.xlsx`;
      return res.status(200).send({ success: 1, message: "get data success", data: userRegisterReportData, fileName: fileName });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
}

async function codeGenerationUIDParentChildReport(req, res) {
  try {

    let exportType = req.body.exportType
    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");

    let difference = endDate.diff(startDate, 'days')

    console.log("difference::", difference);


    if (difference < 0) {
      return res.status(200).send({ 'success': 0, message: 'Start date can not be greater than End date' });
    }
    if (difference > 7) {
      return res.status(200).send({ 'success': 0, message: 'Select 7 Days only' });
    }

    startDate = startDate.format('YYYY-MM-DD') + " 00:00:00"
    endDate = endDate.format('YYYY-MM-DD') + " 23:59:59"

    let whereClause = {
      location_id: req.body.locationId,
      createdAt: {
        [Op.between]: [startDate, endDate]
      },
      is_general: false,
      is_open: false
    }

    let packagingLevels = ['P', 'S', 'T', 'O'];

    if (req.body.packagingLevel) {
      packagingLevels = [req.body.packagingLevel]
    }

    if (req.body.productId) {
      whereClause.product_id = req.body.productId
    }

    if (req.body.poId) {
      whereClause.po_id = req.body.poId
    }

    if (req.body.batchId) {
      whereClause.batch_id = req.body.batchId
    }

    let data = [];
    let limitReached = false;

    for (let level of packagingLevels) {
      console.log('package level>>>>>>>>>', level);
      if (limitReached) {
        break;
      }
      let ParentModel;
      if (level == 'P') {
        ParentModel = PrimaryQrCodeParent;
      }
      else if (level == 'S') {
        ParentModel = SecondaryQrCodeParent;

      }
      else if (level == 'T') {
        ParentModel = TertiaryQrCodeParent;
      }
      else if (level == 'O') {
        ParentModel = OuterQrCodeParent;
      }
      let parents;
      if (ParentModel) {
        console.log("Parent Model::", ParentModel);
        parents = await ParentModel.findAll({
          where: whereClause,
          include: [
            {
              model: LocationModel,
              raw: true
            },
            {
              model: ProductModel,
              raw: true
            },
            {
              model: ProductBatchModel,
              raw: true
            },
            {
              model: ProductionOrderModel,
              raw: true
            },
          ],
          raw: true,
          nest: true
        })
      }
      if (parents.length > 0) {
        if (req.body.transactionType == 1 && exportType == 3) {
          for (let parent of parents) {
            if (limitReached) {
              break;
            }
            let CustomModel = await getDynamicModel(level, parent.product.u_id)
            let codes = await CustomModel.findAll({
              where: {
                parent_id: parent.id
              },
              raw: true
            })

            if (codes.length > 0) {
              for (let element of codes) {
                if (limitReached) {
                  break
                }
                let obj = {
                  "Transaction Type": "Code Generation",
                  "Date": moment(new Date(parent.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY').toUpperCase(),
                  "Location": parent.location.unique_name,
                  "Item Code": parent.product.name,
                  "PO No.": parent.production_order.po_number,
                  "Batch No.": parent.product_batch.batch_no,
                  "Packaging Level": level,
                  //"Unique Code": element.unique_code
                }

                if (level == 'P') {
                  obj['Primary Unique Code'] = element.unique_code;
                }
                else if (level == 'S') {
                  obj['Secondary Unique Code'] = element.unique_code;
                }
                else if (level == 'T') {
                  obj['Tertiary Unique Code'] = element.unique_code;
                }
                else if (level == 'O') {
                  obj['Outer Unique Code'] = element.unique_code;
                }

                data.push(obj)
                console.log("---------------Lenght", data.length);
                if (data.length == exportLimit) {
                  limitReached = true
                }
              };
            }
          }

        } else if (req.body.transactionType == 2 && exportType == 3) {

        } else if (req.body.transactionType == 3 && exportType == 3) {

        }
      }
    }
    console.log("Data::", data);

    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }
    let fileName = 'Generation_Report';

    fileName = fileName + '_' + (req.body.exportType == 1 ? 'UID' : req.body.exportType == 2 ? 'QTY' : 'Parent_child');
    if (req.body.productId) {
      fileName = fileName + '_' + data[0]['Item Code']
    }

    if (req.body.poId) {
      fileName = fileName + '_' + data[0]['PO No.']
    }

    if (req.body.batchId) {
      fileName = fileName + '_' + data[0]['Batch No.']
    }

    if (packagingLevels.length == 1) {
      fileName = fileName + '_' + packagingLevels[0]
    }


    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm')
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName })

  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ success: 0, message: error.message });
  }
}
async function codeGenerationQTYReport(req, res) {
  try {
    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");

    let difference = endDate.diff(startDate, 'days')

    if (difference < 0) {
      return res.status(200).send({ 'success': 0, message: 'Start date can not be greater than End date' });
    }
    if (difference > 365) {
      return res.status(200).send({ 'success': 0, message: 'Select 1 Ye only' });
    }

    /* transactinType: 
         1 Code Generation
         2 Non Qr - Qr
     */

    if (req.body.transactionType == 1) {
      await codeGenerationQTYReportData(req, res);
    } else if (req.body.transactionType == 2) {
      await mappingTransactionReport(req, res);
    }



  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ success: 0, message: error.message });
  }
}

async function codeGenerationQTYReportData(req, res) {

  try {

    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");

    startDate = startDate.format('YYYY-MM-DD') + " 00:00:00"
    endDate = endDate.format('YYYY-MM-DD') + " 23:59:59"

    let level = req.body.packagingLevel;
    let whereClause = {
      location_id: req.body.locationId[0].item_id,
      createdAt: {
        [Op.between]: [startDate, endDate]
      }
    }

    if (level == 'P') {
      whereClause.primary_codes = { [Op.ne]: 0 }
    }

    if (level == 'S') {
      whereClause.secondary_codes = { [Op.ne]: 0 }
    }

    if (level == 'T') {
      whereClause.tertiary_codes = { [Op.ne]: 0 }
    }

    if (level == 'O') {
      whereClause.outer_codes = { [Op.ne]: 0 }
    }

    if (req.body.productId) {
      whereClause.product_id = req.body.productId
    }

    if (req.body.poId) {
      whereClause.po_number = req.body.poId
    }

    if (req.body.batchId) {
      whereClause.batch_id = req.body.batchId
    }

    let data = [];

    let productionOrders = await ProductionOrderModel.findAll({
      where: whereClause,
      include: [
        {
          model: LocationModel,
          raw: true
        },
        {
          model: ProductModel,
          raw: true
        },
        {
          model: ProductBatchModel,
          raw: true
        },
      ],
      order: [['createdAt', 'ASC']],
      raw: true,
      nest: true
    })


    let limitReached = false;
    for (let element of productionOrders) {
      if (limitReached) {
        break;
      }
      let obj;
      if (level == '') {
        obj = {
          "Location Code": element.location.unique_name,
          "PO No.": element.po_number,
          "Item Code": element.product.name,
          "Batch No.": element.product_batch.batch_no,
          //"MRP": element.case_mrp,
          "Primary Code": element.primary_codes,
          "Secondary Code": element.secondary_codes,
          "Outer Code": element.outer_codes,
          "Tertiary Code": element.tertiary_codes,
          "Date & Time": element.createdAt ? moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD-MMM-YYYY  HH:mm:ss').toUpperCase() : '',

        }
      } else if (level == 'P') {
        obj = {
          "Location Code": element.location.unique_name,
          "PO No.": element.po_number,
          "Item Code": element.product.name,
          "Batch No.": element.product_batch.batch_no,
          //"MRP": element.case_mrp,
          "Primary Code": element.primary_codes,
          "Date & Time": element.createdAt ? moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD-MMM-YYYY  HH:mm:ss').toUpperCase() : '',

        }
      } else if (level == 'S') {
        obj = {
          "Location Code": element.location.unique_name,
          "PO No.": element.po_number,
          "Item Code": element.product.name,
          "Batch No.": element.product_batch.batch_no,
          //"MRP": element.case_mrp,
          "Secondary Code": element.secondary_codes,
          "Date & Time": element.createdAt ? moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD-MMM-YYYY  HH:mm:ss').toUpperCase() : '',

        }
      } else if (level == 'T') {
        obj = {
          "Location Code": element.location.unique_name,
          "PO No.": element.po_number,
          "Item Code": element.product.name,
          "Batch No.": element.product_batch.batch_no,
          //"MRP": element.case_mrp,
          "Tertiary Code": element.tertiary_codes,
          "Date & Time": element.createdAt ? moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD-MMM-YYYY  HH:mm:ss').toUpperCase() : '',

        }
      } else if (level == 'O') {
        obj = {
          "Location Code": element.location.unique_name,
          "PO No.": element.po_number,
          "Item Code": element.product.name,
          "Batch No.": element.product_batch.batch_no,
          //"MRP": element.case_mrp,
          "Outer Code": element.outer_codes,
          "Date & Time": element.createdAt ? moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD-MMM-YYYY  HH:mm:ss').toUpperCase() : '',

        }
      }

      data.push(obj);
    }

    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }

    let fileName = 'Mapping_Report';
    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm')
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName })
  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ success: 0, message: error.message });
  }

}

async function codeGenerationQTYReport1(req, res) {
  try {


    //-----------------------------------------
    let genProductInfo = await getGeneralProductInfo();

    if (!genProductInfo) {
      return res.status(200).send({ success: 0, message: "General Product Not Found" })
    }

    let GeneralModels = {
      PGeneralModel: await getDynamicModel('P', genProductInfo.u_id),
      SGeneralModel: await getDynamicModel('S', genProductInfo.u_id),
      TGeneralModel: await getDynamicModel('T', genProductInfo.u_id),
      OGeneralModel: await getDynamicModel('O', genProductInfo.u_id)
    }
    //--------------------------------------------------------

    let exportType = req.body.exportType
    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");

    let difference = endDate.diff(startDate, 'days')

    console.log("difference::", difference);


    if (difference < 0) {
      return res.status(200).send({ 'success': 0, message: 'Start date can not be greater than End date' });
    }
    if (difference > 7) {
      return res.status(200).send({ 'success': 0, message: 'Select 7 Days only' });
    }

    startDate = startDate.format('YYYY-MM-DD') + " 00:00:00"
    endDate = endDate.format('YYYY-MM-DD') + " 23:59:59"

    req.body.locationId = req.body.locationId[0].item_id;
    let whereClause = {
      location_id: req.body.locationId,
      createdAt: {
        [Op.between]: [startDate, endDate]
      },
      is_general: false,
      is_open: false
    }

    let packagingLevels = ['P', 'S', 'T', 'O'];

    if (req.body.packagingLevel) {
      packagingLevels = [req.body.packagingLevel]
    }

    if (req.body.productId) {
      whereClause.product_id = req.body.productId
    }

    if (req.body.poId) {
      whereClause.po_id = req.body.poId
    }

    if (req.body.batchId) {
      whereClause.batch_id = req.body.batchId
    }

    console.log("----whereclause::", whereClause);

    let data = [];
    let limitReached = false;

    console.log("----req.body.packagingLevel::", req.body.packagingLevel);


    for (let level of packagingLevels) {
      console.log("----level::", level);
      if (limitReached) {
        break;
      }
      let ParentModel = null;
      if (level == 'P') {
        ParentModel = PrimaryQrCodeParent;
      }
      else if (level == 'S') {
        ParentModel = SecondaryQrCodeParent;

      }
      else if (level == 'T') {
        ParentModel = TertiaryQrCodeParent;
      }
      else if (level == 'O') {
        ParentModel = OuterQrCodeParent;
      }
      let parents;
      if (ParentModel) {
        console.log("Parent Model::", ParentModel);
        parents = await ParentModel.findAll({
          where: whereClause,
          include: [
            {
              model: LocationModel,
              raw: true
            },
            {
              model: ProductModel,
              raw: true
            },
            {
              model: ProductBatchModel,
              raw: true
            },
            {
              model: ProductionOrderModel,
              raw: true
            },
            {
              model: CompanyUser,
              raw: true
            },
          ],
          order: [['createdAt', 'ASC']],
          raw: true,
          nest: true,
        })
        console.log("exportType::::", exportType)
        console.log("parents.length::::", parents.length)
      }
      if (parents.length > 0) {

        console.log("exportType::::", exportType)

        if (exportType == 2) {   // Quantity
          for (let element of parents) {
            if (limitReached) {
              break;
            }
            let obj = {
              "Transaction Type": "Code Generation",
              "Transaction Date": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
              "Location": element.location.unique_name,
              "Item Code": element.product.sku,
              "PO No.": element.production_order.po_number,
              "Batch No.": element.product_batch.batch_no,
              "Packaging Level": level,
              "Quantity": element.total_qrcode
            }

            data.push(obj)
            if (data.length == exportLimit) {
              console.log("---------------------------Limit reached--------child");
              limitReached = true
            }
          };
        }
        else if (exportType == 1) { // UID
          for (let parent of parents) {
            if (limitReached) {
              break;
            }
            let CustomModel = await getDynamicModel(level, parent.product.u_id);
            let codes = await CustomModel.findAll({
              where: {
                parent_id: parent.id
              },
              order: [['createdAt', 'ASC']],
              raw: true,
              nest: true
            })

            if (codes.length > 0) {
              for (let element of codes) {
                if (limitReached) {
                  break
                }
                let mrpData = await qrcodeController.getCalculatedMRP(parent.product_batch, parent.product_batch.mrp);
                let varName = level.toLowerCase() + 'MRP';
                let UIDMrp = mrpData[varName];
                let obj = {
                  "Transaction Type": "Code Generation",
                  "Transaction Date": moment(new Date(parent.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
                  "Location": parent.location.unique_name,
                  "Item Code": parent.product.sku,
                  "PO No.": parent.production_order.po_number,
                  "Batch No.": parent.product_batch.batch_no,
                  "Packaging Level": level,
                  "Unique Code": element.unique_code,
                  "Mfg. Date": moment(new Date(parent.product_batch.mfg_date)).tz("Asia/Kolkata").format('DD/MMM/YYYY').toUpperCase(),
                  "Exp. Date": moment(new Date(parent.product_batch.exp_date)).tz("Asia/Kolkata").format('DD/MMM/YYYY').toUpperCase(),
                  "MRP": UIDMrp,
                  "User": parent.company_user.name,
                  "Asset ID": ''
                }

                data.push(obj)
                console.log("---------------Lenght", data.length);
                if (data.length == exportLimit) {
                  limitReached = true
                }
              };
            }
          }
        }
        else if (exportType == 3) {  // UID Parent Child
          for (let parent of parents) {
            if (limitReached) {
              break;
            }
            let innerLevel = await commonController.getInnerLevel(parent.product_batch, level);
            let parentLevel = await commonController.getParentLevel(parent.product_batch, level);
            let CustomModel = await getDynamicModel(level, parent.product.u_id);

            let codes = await CustomModel.findAll({
              where: {
                parent_id: parent.id
              },

              order: [['createdAt', 'ASC']],
              raw: true,
              nest: true
            })

            let allChilds = []
            if (innerLevel) {
              let codeIds = await codes.map(itm => {
                return itm.id
              })
              let ChildModel = await getDynamicModel(innerLevel, parent.product.u_id)
              let GeneralChildModel = GeneralModels[`${innerLevel}GeneralModel`];

              let childCodes = await ChildModel.findAll({
                where: {
                  mapped_to_parent: {
                    [Op.in]: codeIds
                  },
                  is_replaced: false
                },
                attributes: ['id', 'unique_code', 'mapped_to_parent', 'is_general', 'is_open', 'mapped_at'],
                raw: true
              })
              let generalChildCodes = await GeneralChildModel.findAll({
                where: {
                  mapped_to_parent: {
                    [Op.in]: codeIds
                  },
                  is_replaced: false
                },
                attributes: ['id', 'unique_code', 'mapped_to_parent', 'is_general', 'is_open', 'mapped_at'],
                raw: true
              })

              allChilds = [...childCodes, ...generalChildCodes];

              const result = allChilds.reduce((acc, { mapped_to_parent, unique_code }) => {
                if (!acc[mapped_to_parent]) {
                  acc[mapped_to_parent] = unique_code;
                } else {
                  acc[mapped_to_parent] += `,${unique_code}`;
                }
                return acc;
              }, {});

              console.log(result);

              allChilds = result;

            }


            let allParents = []
            if (parentLevel) {
              let parentIds = await codes.map(itm => {
                return itm.mapped_to_parent
              })
              let ParentModel = await getDynamicModel(parentLevel, parent.product.u_id)
              let GeneralParentModel = GeneralModels[`${parentLevel}GeneralModel`];

              let parentCodes = await ParentModel.findAll({
                where: {
                  id: {
                    [Op.in]: parentIds
                  },
                  is_replaced: false
                },
                attributes: ['id', 'unique_code', 'mapped_to_parent', 'is_general', 'is_open', 'mapped_at'],
                raw: true
              })
              let generalParentCodes = await GeneralParentModel.findAll({
                where: {
                  id: {
                    [Op.in]: parentIds
                  },
                  is_replaced: false
                },
                attributes: ['id', 'unique_code', 'mapped_to_parent', 'is_general', 'is_open', 'mapped_at'],
                raw: true
              })

              allParents = [...parentCodes, ...generalParentCodes];

              const resultParents = allParents.reduce((acc, { id, unique_code }) => {
                if (!acc[id]) {
                  acc[id] = unique_code;
                } else {
                  acc[id] += `,${unique_code}`;
                }
                return acc;
              }, {});

              console.log(resultParents);
              allParents = resultParents;
            }

            if (codes.length > 0) {
              let transactionDate = moment(new Date(parent.createdAt)).format('DD/MMM/YYYY HH:mm:ss').toUpperCase();
              let mrpData = await qrcodeController.getCalculatedMRP(parent.product_batch, parent.product_batch.mrp);
              let UIDMrp = mrpData[`${level.toLowerCase()}MRP`];
              for (let element of codes) {
                if (limitReached) {
                  break
                }
                let parentCode = ''
                let childCodes = '';
                if (innerLevel) {
                  childCodes = allChilds[`${element.id}`];
                }
                if (parentLevel) {
                  parentCode = allParents[`${element.mapped_to_parent}`];
                }
                let obj = {
                  "Transaction Type": "Code Generation",
                  "Transaction Date": transactionDate,
                  "Location": parent.location.unique_name,
                  "PO No.": parent.production_order.po_number,
                  "Item Code": parent.product.sku,
                  "Batch No.": parent.product_batch.batch_no,
                  "Packaging Level": level,
                  "Unique Code": element.unique_code,
                  "MRP": UIDMrp,
                  "Parent": parentCode,
                  "Child": childCodes,
                }

                data.push(obj)
                if (data.length == exportLimit) {
                  limitReached = true
                }
              }
            }
          }
        }

      }
    }

    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }
    let fileName = 'Generation_Report';

    fileName = fileName + '_' + (req.body.exportType == 1 ? 'UID' : req.body.exportType == 2 ? 'QTY' : 'Parent_child');
    if (req.body.productId) {
      fileName = fileName + '_' + data[0]['Item Code']
    }

    if (req.body.poId) {
      fileName = fileName + '_' + data[0]['PO No.']
    }

    if (req.body.batchId) {
      fileName = fileName + '_' + data[0]['Batch No.']
    }

    if (packagingLevels.length == 1) {
      fileName = fileName + '_' + packagingLevels[0]
    }


    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm')
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName })
  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ success: 0, message: error.message });
  }
}

async function mappingTransactionReport(req, res) {
  try {

    let genProductInfo = await getGeneralProductInfo();

    if (!genProductInfo) {
      return res.status(200).send({ success: 0, message: "General Product Not Found" })
    }

    let GeneralModels = {
      PGeneralModel: await getDynamicModel('P', genProductInfo.u_id),
      SGeneralModel: await getDynamicModel('S', genProductInfo.u_id),
      TGeneralModel: await getDynamicModel('T', genProductInfo.u_id),
      OGeneralModel: await getDynamicModel('O', genProductInfo.u_id)
    }


    let isOther = (req.body.transactionType == 3);
    console.log("-----------------is Other------------", isOther);
    let exportType = req.body.exportType
    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");

    let difference = endDate.diff(startDate, 'days')

    console.log("difference::", difference);

    if (difference < 0) {
      return res.status(200).send({ 'success': 0, message: 'Start date can not be greater than End date' });
    }
    if (difference > 365) {
      return res.status(200).send({ 'success': 0, message: 'Select 1 year only' });
    }

    startDate = startDate.format('YYYY-MM-DD') + " 00:00:00"
    endDate = endDate.format('YYYY-MM-DD') + " 23:59:59"
    let whereClause = {};
    if (req.body.locationId.length > 1) {
      let locationArray = req.body.locationId.map((x) => {
        return (x.item_id)
      })
      whereClause = {
        location_id: {
          [Op.in]: locationArray
        },
        createdAt: {
          [Op.between]: [startDate, endDate]
        },
        is_other: isOther,
      }
    } else {
      whereClause = {
        location_id: req.body.locationId[0].item_id,
        createdAt: {
          [Op.between]: [startDate, endDate]
        },
        is_other: isOther,
      }
    }

    let packagingLevels = ['P', 'S', 'T', 'O'];

    if (req.body.packagingLevel) {
      packagingLevels = [req.body.packagingLevel]
    }

    if (packagingLevels.length == 1) {
      whereClause.packaging_level = packagingLevels[0]
    }

    if (req.body.productId) {
      whereClause.product_id = req.body.productId
    }

    if (req.body.poId) {
      whereClause.po_id = req.body.poId
    }

    if (req.body.batchId) {
      whereClause.batch_id = req.body.batchId
    }

    console.log("----whereclause::", whereClause);

    let transactions = await MappingTransactionModel.findAll({
      where: whereClause,
      include: [
        {
          model: LocationModel,
          raw: true
        },
        {
          model: ProductModel,
          raw: true
        },
        {
          model: ProductBatchModel,
          raw: true
        },
        {
          model: ProductionOrderModel,
          raw: true
        },
        {
          model: CompanyUser,
          raw: true
        },
        {
          model: Devices,
          raw: true
        },
      ],
      order: [['createdAt', 'ASC']],
      raw: true,
      nest: true
    })
    let data = [];
    let limitReached = false;
    console.log("Transacations::", transactions.length);

    for (let [index, element] of transactions.entries()) {
      console.log(">>>>>>>>>>>Elemen::", index + 1, ">>>>>>>>>>>>>>>>>>>", data.length);
      if (limitReached) {
        break;
      }

      if (exportType == 2) { // Quantity
        let obj = {
          "Transaction Type": !isOther ? "Mapping" : 'Non-QR-To-QR',
          "Transaction Date": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
          "Location": element.location.unique_name,
          "Item Code": element.product.sku,
          "PO No.": element.production_order.po_number,
          "Batch No.": element.product_batch.batch_no,
          "Packaging Level": element.packaging_level,
          "Mapped Count": element.mapped_count
        }
        data.push(obj);

        if (data.length == exportLimit) {
          limitReached = true
        }
      }
      else if (exportType == 1) { //UID
        let SpecificModel, GeneralModel, ChildModel;

        SpecificModel = await getDynamicModel(element.packaging_level, element.u_id);

        if (isOther) {
          GeneralModel = await getDynamicModel(element.packaging_level, element.gen_uid);
        }
        else {
          if (element.inner_level) {
            ChildModel = await getDynamicModel(element.packaging_level, element.u_id);
          }
        }

        let specificCodes = await SpecificModel.findAll({
          where: {
            transaction_id: element.id,
          },
          order: [['createdAt', 'ASC']],
          raw: true,
          nest: true
        })
        let generalCodes = [];
        if (GeneralModel) {
          generalCodes = await GeneralModel.findAll({
            where: {
              transaction_id: element.id,
            },
            order: [['createdAt', 'ASC']],
            raw: true,
            nest: true
            //limit: 1000
          })
        }
        let childCodes = [];

        if (ChildModel) {
          childCodes = await ChildModel.findAll({
            where: {
              mapp_transaction_id: element.id,
            },
            order: [['createdAt', 'ASC']],
            raw: true,
            nest: true
            //limit: 1000
          })
        }
        let mrpData = await qrcodeController.getCalculatedMRP(element.product_batch, element.product_batch.mrp);
        let varName = element.packaging_level.toLowerCase() + 'MRP';
        let UIDMrp = mrpData[varName];

        for (let item of specificCodes) {
          if (limitReached) {
            break;
          }
          let obj = {
            "Transaction Type": !isOther ? "Mapping" : 'Non-QR-To-QR',
            "Transaction Date": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
            "Location": element.location.unique_name,
            "Item Code": element.product.sku,
            "PO No.": element.production_order.po_number,
            "Batch No.": element.product_batch.batch_no,
            "unique_code": item.unique_code,
            "Code Level": element.packaging_level,
            "Mfg. Date": moment(new Date(element.product_batch.mfg_date)).tz("Asia/Kolkata").format('DD/MMM/YYYY').toUpperCase(),
            "Exp. Date": moment(new Date(element.product_batch.exp_date)).tz("Asia/Kolkata").format('DD/MMM/YYYY').toUpperCase(),
            "MRP": UIDMrp ? UIDMrp : '',
            "User": element.company_user.name,
            "Asset ID": element.device.asset_id ? element.device.asset_id : '',
            "Code Type": "Specific",
          }
          if (isOther) {
            //obj['Activated At'] = moment(new Date(item.completed_at)).format('DD/MMM/YYYY HH:mm:ss').toUpperCase();
          }
          else {
            obj['Transacation Level'] = element.packaging_level,
              obj['Completed At'] = moment(new Date(item.completed_at)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase();
          }
          data.push(obj);
          if (data.length == exportLimit) {
            console.log("---------------------------Limit reached--------Specific");
            limitReached = true
          }
        }

        for (let item of generalCodes) {
          if (limitReached) {
            break;
          }
          let obj = {
            "Transaction Type": 'Non-QR-To-QR',
            "Transaction Date": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
            "Location": element.location.unique_name,
            "Item Code": element.product.sku,
            "PO No.": element.production_order.po_number,
            "Batch No.": element.product_batch.batch_no,
            "unique_code": item.unique_code,
            "Code Level": element.packaging_level,
            "Mfg. Date": moment(new Date(element.product_batch.mfg_date)).tz("Asia/Kolkata").format('DD/MMM/YYYY').toUpperCase(),
            "Exp. Date": moment(new Date(element.product_batch.exp_date)).tz("Asia/Kolkata").format('DD/MMM/YYYY').toUpperCase(),
            "MRP": UIDMrp ? UIDMrp : '',
            "User": element.company_user.name,
            "Asset ID": element.device.asset_id ? element.device.asset_id : '',
            "Code Type": "General",
          }
          if (isOther) {
            //obj['Activated At'] = moment(new Date(item.completed_at)).format('DD/MMM/YYYY HH:mm:ss').toUpperCase();
          }
          else {
            obj['Transacation Level'] = element.packaging_level
            obj['Activated At'] = moment(new Date(item.completed_at)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase()

          }
          data.push(obj)
          if (data.length == exportLimit) {
            console.log("---------------------------Limit reached--------General");
            limitReached = true
          }
        }

        let chilUIDMrp = '';
        if (element.inner_level) {
          let varName2 = element.inner_level.toLowerCase() + 'MRP';
          chilUIDMrp = mrpData[varName2];
        }

        for (let item of childCodes) {
          if (limitReached) {
            break;
          }
          let obj = {
            "Transaction Type": !isOther ? "Mapping" : 'Non-QR-To-QR',
            "Transaction Date": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
            "Location": element.location.unique_name,
            "Item Code": element.product.sku,
            "PO No.": element.production_order.po_number,
            "Batch No.": element.product_batch.batch_no,
            "Transacation Level": element.packaging_level,
            "unique_code": item.unique_code,
            "Code Level": element.inner_level,
            "Mfg. Date": moment(new Date(element.product_batch.mfg_date)).tz("Asia/Kolkata").format('DD/MMM/YYYY').toUpperCase(),
            "Exp. Date": moment(new Date(element.product_batch.exp_date)).tz("Asia/Kolkata").format('DD/MMM/YYYY').toUpperCase(),
            "MRP": chilUIDMrp ? chilUIDMrp : '',
            "User": element.company_user.name,
            "Asset ID": element.device.asset_id ? element.device.asset_id : '',
            "Mapped At": moment(new Date(item.mapped_at)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
            "Code Type": "Specific-Child",
          }
          data.push(obj)
          if (data.length == exportLimit) {
            console.log("---------------------------Limit reached--------child");
            limitReached = true
          }
        }
        console.log("-----------------Total Counts::", data.length);
      }
      else if (exportType == 3) { // UID Parent Child
        let SpecificModel;
        let ChildModel;
        let GeneralChildModel;


        let GeneralModel;

        let packagingLevel = element.packaging_level;

        GeneralModel = GeneralModels[`${packagingLevel}GeneralModel`];
        SpecificModel = await getDynamicModel(packagingLevel, element.u_id);
        let allChilds;
        let parentChilds = {};

        console.log("SpecificModel::", SpecificModel);
        let specificCodes = await SpecificModel.findAll({
          where: {
            transaction_id: element.id,
          },
          order: [['createdAt', 'ASC']],
          attributes: ['id', 'unique_code', 'mapped_to_parent', 'is_general', 'is_open', 'mapped_at', 'completed_at'],
          raw: true,
          nest: true,
        })

        let generalCodes = [];

        if (isOther) {   //  If Exporting Non-Qr-Qr Report
          console.log("Searching in General Model::", GeneralModel);
          generalCodes = await GeneralModel.findAll({
            where: {
              transaction_id: element.id,
            },
            order: [['createdAt', 'ASC']],
            attributes: ['id', 'unique_code', 'mapped_to_parent', 'is_general', 'is_open', 'mapped_at', 'completed_at'],

            raw: true,
          })
        }

        // Finding All Child Codes Of this Transaction
        if (element.inner_level) {
          ChildModel = await getDynamicModel(element.inner_level, element.u_id);
          GeneralChildModel = GeneralModels[`${element.inner_level}GeneralModel`];
          let childCodes = await ChildModel.findAll({
            where: {
              mapp_transaction_id: element.id,
              is_replaced: false
            },
            attributes: ['id', 'unique_code', 'mapped_to_parent', 'is_general', 'is_open', 'mapped_at'],
            raw: true
          })
          let generalChildCodes = await GeneralChildModel.findAll({
            where: {
              mapp_transaction_id: element.id,
              is_replaced: false
            },
            attributes: ['id', 'unique_code', 'mapped_to_parent', 'is_general', 'is_open', 'mapped_at'],
            raw: true
          })

          allChilds = [...childCodes, ...generalChildCodes];

          /// -----------Function to Format parent and its child in key value pair
          // example:: {'37df3fbc-9761-4e4d-9b47-808a0d8f161a': 'JP4PCF4M9EK,ZU4CXM4U9H8'},
          const result = allChilds.reduce((acc, { mapped_to_parent, unique_code }) => {
            if (!acc[mapped_to_parent]) {
              acc[mapped_to_parent] = unique_code;
            } else {
              acc[mapped_to_parent] += `,${unique_code}`;
            }
            return acc;
          }, {});

          console.log(result);
          parentChilds = result;

        }
        console.log("parentChilds:::", parentChilds);
        // General And Specific Both  Codes
        let allParents = [...specificCodes, ...generalCodes];

        let mrpData = await qrcodeController.getCalculatedMRP(element.product_batch, element.product_batch.mrp);
        // console.log("---Mrp Calculated", mrpData);
        let UIDMrp = mrpData[`${packagingLevel.toLowerCase()}MRP`];
        let transactionDate = moment(new Date(element.createdAt)).format('DD/MMM/YYYY HH:mm:ss').toUpperCase();
        for (let item of allParents) {
          if (limitReached) {
            break;
          }
          let childCodes = parentChilds[`${item.id}`];
          // console.log(">>>>>>>>>>>>>", childCodes);
          let obj = {
            "Transaction Type": !isOther ? "Mapping" : 'Non-QR-To-QR',
            "Transaction Date": transactionDate,
            "Transacation Level": element.packaging_level,
            "Location": element.location.unique_name,
            "PO No.": element.production_order.po_number,
            "Item Code": element.product.sku,
            "Batch No.": element.product_batch.batch_no,
            "Unique Code": item.unique_code,
            "Code Level": element.packaging_level,
            "Code Type": (item.is_general || item.is_open) ? item.is_general ? "General" : "Open" : 'Specific',
            "MRP": UIDMrp,
            "Mapped At": moment(new Date(item.completed_at)).format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
            "Childs": childCodes,
            "Parent": '',
          }

          data.push(obj);
          if (data.length == exportLimit) {
            console.log("---------------------------Limit reached--------Specific");
            limitReached = true
          }
        }

        if (element.inner_level && !limitReached && allChilds.length > 0) {
          let childUIDMrp = mrpData[`${element.inner_level.toLowerCase()}MRP`];
          let childCodesWithParentCode = allChilds.map(child => {
            let parent = allParents.find(parent => parent.id === child.mapped_to_parent);
            let parent_code = parent ? parent.unique_code : null;
            return { ...child, parent_code };
          });

          console.log(">>>>>>>>>", childCodesWithParentCode);

          for (let item of childCodesWithParentCode) {
            if (limitReached) {
              break;
            }
            let obj = {
              "Transaction Type": !isOther ? "Mapping" : 'Non-QR-To-QR',
              "Transaction Date": transactionDate,
              "Transacation Level": element.packaging_level,
              "Location": element.location.unique_name,
              "PO No.": element.production_order.po_number,
              "Item Code": element.product.sku,
              "Batch No.": element.product_batch.batch_no,
              "Unique Code": item.unique_code,
              "Code Level": element.inner_level,
              "Code Type": (item.is_general || item.is_open) ? item.is_general ? "General" : "Open" : 'Specific',
              "MRP": childUIDMrp,
              "Mapped At": moment(new Date(item.mapped_at)).format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
              "Childs": '',
              "Parent": item.parent_code,
            }
            data.push(obj)
            if (data.length == exportLimit) {
              console.log("---------------------------Limit reached--------child");
              limitReached = true
            }
          }
        }
      }
    }

    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }

    let fileName = !isOther ? 'Mapping_Transaction_Report' : 'Non-QR-To-QR_Transactions';

    fileName = fileName + '_' + (req.body.exportType == 1 ? 'UID' : req.body.exportType == 2 ? 'QTY' : 'Parent_child');

    if (req.body.productId) {
      fileName = fileName + '_' + data[0]['Item Code']
    }

    if (req.body.poId) {
      fileName = fileName + '_' + data[0]['PO No.']
    }

    if (req.body.batchId) {
      fileName = fileName + '_' + data[0]['Batch No.']
    }

    if (packagingLevels.length == 1) {
      fileName = fileName + '_' + packagingLevels[0]
    }

    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm')
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName })
  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ success: 0, message: error.message });
  }
}

async function replacementReport(req, res, exportType) {
  try {
    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");

    let difference = endDate.diff(startDate, 'days')

    console.log("difference::", difference);


    if (difference < 0) {
      return res.status(200).send({ 'success': 0, message: 'Start date can not be greater than End date' });
    }
    if (difference > 7) {
      return res.status(200).send({ 'success': 0, message: 'Select 7 Days only' });
    }

    startDate = startDate.format('YYYY-MM-DD') + " 00:00:00"
    endDate = endDate.format('YYYY-MM-DD') + " 23:59:59"

    let whereClause = {};
    if (req.body.locationId.length > 1) {
      let locationArray = req.body.locationId.map((x) => {
        return (x.item_id)
      })
      whereClause = {
        location_id: {
          [Op.in]: locationArray
        },
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      }
    } else {
      whereClause = {
        location_id: req.body.locationId[0].item_id,
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      }
    }

    // let whereClause = {
    //     location_id: req.body.locationId,
    //     createdAt: {
    //         [Op.between]: [startDate, endDate]
    //     },
    // }

    let packagingLevels = ['P', 'S', 'T', 'O'];
    // Only One Packaging Level
    if (req.body.packagingLevel) {
      packagingLevels = [req.body.packagingLevel]
    }

    if (packagingLevels.length == 1) {
      whereClause.packaging_level = packagingLevels[0]
    }

    if (req.body.productId) {
      whereClause.product_id = req.body.productId
    }

    if (req.body.batchId) {
      whereClause.batch_id = req.body.batchId
    }

    console.log("----whereclause::", whereClause);
    let limitReached = false;
    let data = [];

    let transactions = await ReplacementHistory.findAll({
      where: whereClause,
      include: [
        {
          model: LocationModel,
          raw: true
        },
        {
          model: ProductModel,
          raw: true
        },
        {
          model: ProductBatchModel,
          raw: true
        },
        {
          model: CompanyUser,
          raw: true
        },
        {
          model: Devices,
          raw: true
        },
      ],
      order: [['createdAt', 'ASC']],
      raw: true,
      nest: true
    })

    if (exportType == 2) {   // Quantity
      let replaceHistory = await ReplacementHistory.findAll({
        where: whereClause,
        include: [
          {
            model: LocationModel,
            attributes: ["name", "id", "unique_name"],
            raw: true
          },
          {
            model: ProductModel,
            attributes: ["name", "id", "u_id", "sku"],
            raw: true
          },
          {
            model: ProductBatchModel,
            attributes: ["batch_no", "id"],
            raw: true
          },
        ],
        attributes: [[sequelize.fn('MAX', sequelize.col('replacement_history.createdAt')), 'createdAt'], 'packaging_level', [sequelize.fn('COUNT', sequelize.col('packaging_level')), 'count'], 'location.id', 'product.id', 'product.sku', 'product_batch.id'],
        group: ['packaging_level', 'location.id', 'product.id', 'product.sku', 'product_batch.id', 'product_batch.batch_no'],
        //order: [['createdAt', 'ASC']],
        raw: true,
        nest: true
      })
      replaceHistory = replaceHistory.sort((a, b) => {
        let da = new Date(a.createdAt),
          db = new Date(b.createdAt);
        return da - db;
      });
      for (let element of replaceHistory) {
        if (limitReached) {
          break;
        }
        let obj = {
          "Transaction Type": "Replacement",
          "Transaction Date": element.createdAt ? moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase() : '',
          "Location": element.location.unique_name,
          "Item Code": element.product.sku,
          "Batch No.": element.product_batch.batch_no,
          "Packaging Level": element.packaging_level,
          //"code": element.code,
          //"code Type": element.code_type,
          //"Replaced With": element.replaced_with,
          //"Replaced Type": element.replaced_with_type,
          //"Replaced At": moment(new Date(element.replaced_at)).format('DD/MMM/YYYY').toUpperCase(),
          "Quantity": element.count,
        }
        data.push(obj)
        if (data.length == exportLimit) {
          console.log("---------------------------Limit reached--------child");
          limitReached = true
        }
      };
    }
    else if (exportType == 1) { // UID
      for (let element of transactions) {
        if (limitReached) {
          break;
        }
        let UIDMrp = '-';
        let mrpData = await qrcodeController.getCalculatedMRP(element.product_batch, element.product_batch.mrp);
        console.log("---Mrp Calculated", mrpData);
        let varName = element.packaging_level.toLowerCase() + 'MRP';
        UIDMrp = mrpData[varName];
        let obj = {
          "Transaction Type": "Replacement",
          "Transaction Date": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
          "Location": element.location.unique_name,
          "Item Code": element.product.sku,
          "Batch No.": element.product_batch.batch_no,
          "Mfg. Date": moment(new Date(element.product_batch.mfg_date)).tz("Asia/Kolkata").format('DD/MMM/YYYY').toUpperCase(),
          "Exp. Date": moment(new Date(element.product_batch.exp_date)).tz("Asia/Kolkata").format('DD/MMM/YYYY').toUpperCase(),
          "MRP": UIDMrp ? UIDMrp : '',
          "User": element.company_user.name,
          "Packaging Level": element.packaging_level,
          "code": element.code,
          "code Type": element.code_type,
          "Replaced With": element.replaced_with,
          "Replaced Type": element.replaced_with_type,
          "Replaced At": moment(new Date(element.replaced_at)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
          "Mapped Count": element.mapped_count,
          "Asset ID": element.device.asset_id ? element.device.asset_id : '',
        }
        data.push(obj)
        if (data.length == exportLimit) {
          console.log("---------------------------Limit reached--------child");
          limitReached = true
        }
      };
    }
    else if (exportType == 3) { // UID Parent Child
      let uId;
      if (req.body.productId) {
        let product = await ProductModel.findOne({
          where: {
            id: req.body.productId
          }
        })
        uId = product.u_id
      }
      for (let element of transactions) {
        if (limitReached) {
          break;
        }
        uId = element.product.u_id;
        let customCodes = [];
        let customModel = await getDynamicModel(element.packaging_level, uId);
        if (customModel) {
          customModel.hasOne(MappingTransactionModel, {
            foreignKey: 'id',
            sourceKey: 'mapp_transaction_id',
            as: 'transaction'
          })

          customModel.hasOne(MappingTransactionModel, {
            foreignKey: 'id',
            sourceKey: 'transaction_id',
            as: 'mapping_transaction'
          })

          customModel.hasOne(CompanyUser, {
            foreignKey: 'id',
            sourceKey: 'replaced_by',
            as: 'replaced_by_user'
          })

          customModel.hasOne(ProductionOrderModel, {
            foreignKey: 'id',
            sourceKey: 'po_id'
          })
        }

        customCodes = await customModel.findAll({
          where: {
            unique_code: element.code
            // [Op.or]: [
            //     {
            //         transaction_id: element.id,
            //     },
            //     {
            //         mapp_transaction_id: element.id,
            //     }
            // ]
          },
          include: [
            {
              model: ProductModel,
              as: 'product',
              raw: true,
            },
            {
              model: ProductModel,
              as: 'assigned_product',
              raw: true,
            },
            {
              model: ProductionOrderModel,
              raw: true
            },

            {
              model: ProductBatchModel,
              as: 'product_batch',
              raw: true,
            },
            {
              model: ProductBatchModel,
              as: 'assigned_batch',
              raw: true,
            },

            {
              model: MappingTransactionModel,
              raw: true,
              as: 'mapping_transaction'
            },
            {
              model: MappingTransactionModel,
              raw: true,
              as: 'transaction'
            },
            {
              model: CompanyUser,
              raw: true,
              as: 'replaced_by_user'
            }

          ],
          order: [['createdAt', 'ASC']],
          raw: true,
          nest: true,
          //limit: 1000
        })
        console.log('customCodes:::::::::::::::', customCodes.length);
        if (customCodes.length > 0) {
          for (let item of customCodes) {
            if (limitReached) {
              break;
            }
            let details = await getParentChildDetails(item);
            if (details.success == 1) {
              let obj = {
                "Transaction Type": "Replacement",
                "Transaction Date": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
                "Location": element.location.unique_name,
                "Item Code": element.product.sku,
                "Batch No.": element.product_batch.batch_no,
                "MRP": details.data.UIDMrp ? details.data.UIDMrp : '',
                "Packaging Level": element.packaging_level,
                "code Type": element.code_type,
                "code": element.code,
                "Parent": details.data.parent.toString(),
                "Child": details.data.child.toString(),
                "Replaced With": element.replaced_with,
                "Replaced Type": element.replaced_with_type,
                "Replaced At": moment(new Date(element.replaced_at)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
                "Mapped Count": element.mapped_count,
                "Asset ID": element.device.asset_id ? element.device.asset_id : '',
              }
              data.push(obj)
            }
            if (data.length == exportLimit) {
              console.log("---------------------------Limit reached--------child");
              limitReached = true
            }
          }

        }
      };
    }

    console.log("Data::", data.length);

    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }
    let fileName = 'Replacement_Report';
    fileName = fileName + '_' + (req.body.exportType == 1 ? 'UID' : req.body.exportType == 2 ? 'QTY' : 'Parent_child');

    if (req.body.productId) {
      fileName = fileName + '_' + data[0]['Item Code']
    }

    if (req.body.batchId) {
      fileName = fileName + '_' + data[0]['Batch No.']
    }

    if (packagingLevels.length == 1) {
      fileName = fileName + '_' + packagingLevels[0]
    }

    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm')
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName })
  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ success: 0, message: error.message });
  }
}

async function poReceivedErpSyncReport(req, res) {
  try {
    let exportType = req.body.exportType;
    let packagingLevels = ['O'];
    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");

    let difference = endDate.diff(startDate, 'days')

    console.log("difference::", difference);


    if (difference < 0) {
      return res.status(200).send({ 'success': 0, message: 'Start date can not be greater than End date' });
    }
    if (difference > 7) {
      return res.status(200).send({ 'success': 0, message: 'Select 7 Days only' });
    }

    startDate = startDate.format('YYYY-MM-DD') + " 00:00:00"
    endDate = endDate.format('YYYY-MM-DD') + " 23:59:59"

    let whereClause = {
      location_id: req.body.locationId,
      createdAt: {
        [Op.between]: [startDate, endDate]
      },
      is_from_erp: true
    }

    let data = [];

    let productionOrders = await ProductionOrderModel.findAll({
      where: whereClause,
      include: [
        {
          model: LocationModel,
          raw: true
        },
        {
          model: ProductModel,
          raw: true
        },
        {
          model: ProductBatchModel,
          raw: true
        },
      ],
      order: [['createdAt', 'ASC']],
      raw: true,
      nest: true
    })
    let limitReached = false;
    for (let element of productionOrders) {
      if (limitReached) {
        break;
      }

      if (exportType == 1) { // UID
        if (element.status != 3) {

          let transactions = await MappingTransactionModel.findAll({
            where: {
              po_id: element.id,
              //packaging_level: 'O'
            },
            include: [
              {
                model: LocationModel,
                raw: true
              },
              {
                model: ProductModel,
                raw: true
              },
              {
                model: ProductBatchModel,
                raw: true
              },
              {
                model: ProductionOrderModel,
                raw: true
              },
            ],
            order: [['createdAt', 'ASC']],
            raw: true,
            nest: true
          })
          console.log('transactions:::::::::::::', transactions.length);
          for (let item of transactions) {
            if (limitReached) {
              break;
            }
            let erpSyncReason = await ErpTransferModel.findOne({
              where: {
                transaction_id: item.id
              },
              order: [['createdAt', 'ASC']],
            })
            let customModel = await getDynamicModel(item.packaging_level, item.u_id);
            if (customModel) {
              let codes = await customModel.findAll({
                where: {
                  transaction_id: item.id
                },
                order: [['createdAt', 'ASC']],
                raw: true
              })
              if (codes.length > 0) {
                for (let code of codes) {
                  if (limitReached) {
                    break;
                  }
                  if (!code.is_replaced) {
                    if (code.is_mapped || code.is_complete) {
                      let obj = {
                        "Location Code": item.location.unique_name,
                        "PO No.": element.po_number,
                        "PO Date": moment(new Date(element.po_date)).tz("Asia/Kolkata").format('DD-MMM-YYYY HH:mm:ss').toUpperCase(),
                        "Transaction Type": 'PO Received',
                        "Item Code": item.product.sku,
                        "Batch No.": item.product_batch.batch_no,
                        "Mfg Date": moment(new Date(element.mfg_date)).tz("Asia/Kolkata").format('DD-MMM-YYYY').toUpperCase(),
                        "Exp Date": moment(new Date(element.exp_date)).tz("Asia/Kolkata").format('DD-MMM-YYYY').toUpperCase(),
                        "MRP": element.case_mrp,
                        "Unique Code": code.unique_code,
                        "Qty (cases)": element.batch_size,
                        "Date & Time of receiving from ERP": moment(new Date(item.createdAt)).tz("Asia/Kolkata").format('DD-MMM-YYYY HH:mm:ss').toUpperCase(),
                        "Sync Status": item.erp_sync_status == 0 ? 'Pending' : item.erp_sync_status == 1 ? 'Successfull' : 'Failed',
                        "Errors If any": erpSyncReason ? erpSyncReason.reason : '',
                      }

                      data.push(obj)
                      if (data.length == exportLimit) {
                        console.log("---------------------------Limit reached--------child");
                        limitReached = true
                      }
                    }
                  }
                }
              }
            }
          }
          if (transactions.length <= 0) {
            let obj = {
              "Location Code": element.location.unique_name,
              "PO No.": element.po_number,
              "PO Date": moment(new Date(element.po_date)).tz("Asia/Kolkata").format('DD-MMM-YYYY HH:mm:ss').toUpperCase(),
              "Transaction Type": 'PO Received',
              "Item Code": element.product.sku,
              "Batch No.": element.product_batch.batch_no,
              "Mfg Date": moment(new Date(element.mfg_date)).tz("Asia/Kolkata").format('DD-MMM-YYYY').toUpperCase(),
              "Exp Date": moment(new Date(element.exp_date)).tz("Asia/Kolkata").format('DD-MMM-YYYY').toUpperCase(),
              "MRP": element.case_mrp,
              "Unique Code": '',
              "Qty (cases)": 0,
              "Date & Time of receiving from ERP": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD-MMM-YYYY HH:mm:ss').toUpperCase(),
              "Sync Status": 'Successfull',
              "Errors If any": '',
            }

            data.push(obj)
            if (data.length == exportLimit) {
              console.log("---------------------------Limit reached--------child");
              limitReached = true
            }
          }

        }
      } else if (exportType == 2) { // Quantity
        if (element.status != 3) {

          let transactions = await MappingTransactionModel.findAll({
            where: {
              po_id: element.id,
              //packaging_level: 'O'
            },
            include: [
              {
                model: LocationModel,
                raw: true
              },
              {
                model: ProductModel,
                raw: true
              },
              {
                model: ProductBatchModel,
                raw: true
              },
              {
                model: ProductionOrderModel,
                raw: true
              },
            ],
            order: [['createdAt', 'ASC']],
            raw: true,
            nest: true
          })

          for (let item of transactions) {
            let erpSyncReason = await ErpTransferModel.findOne({
              where: {
                transaction_id: item.id
              },
              order: [['createdAt', 'ASC']],
            })
            let obj = {
              "Location Code": item.location.unique_name,
              "PO No.": element.po_number,
              "PO Date": moment(new Date(element.po_date)).tz("Asia/Kolkata").format('DD-MMM-YYYY HH:mm:ss').toUpperCase(),
              "Transaction Type": 'PO Received',
              "Item Code": item.product.sku,
              "Batch No.": item.product_batch.batch_no,
              "Mfg Date": moment(new Date(element.mfg_date)).tz("Asia/Kolkata").format('DD-MMM-YYYY').toUpperCase(),
              "Exp Date": moment(new Date(element.exp_date)).tz("Asia/Kolkata").format('DD-MMM-YYYY').toUpperCase(),
              "MRP": element.case_mrp,
              "Qty (cases)": element.batch_size,
              "Date & Time of receiving from ERP": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD-MMM-YYYY  HH:mm:ss').toUpperCase(),
              "Sync Status": item.erp_sync_status == 0 ? 'Pending' : item.erp_sync_status == 1 ? 'Successfull' : 'Failed',
              "Errors If any": erpSyncReason ? erpSyncReason.reason : '',
            }

            data.push(obj)
            if (data.length == exportLimit) {
              console.log("---------------------------Limit reached--------child");
              limitReached = true
            }

            //}
          }

          if (transactions.length <= 0) {
            let obj = {
              "Location Code": element.location.unique_name,
              "PO No.": element.po_number,
              "PO Date": moment(new Date(element.po_date)).tz("Asia/Kolkata").format('DD-MMM-YYYY HH:mm:ss').toUpperCase(),
              "Transaction Type": 'PO Received',
              "Item Code": element.product.sku,
              "Batch No.": element.product_batch.batch_no,
              "Mfg Date": moment(new Date(element.mfg_date)).tz("Asia/Kolkata").format('DD-MMM-YYYY').toUpperCase(),
              "Exp Date": moment(new Date(element.exp_date)).tz("Asia/Kolkata").format('DD-MMM-YYYY').toUpperCase(),
              "MRP": element.case_mrp,
              "Qty (cases)": 0,
              "Date & Time of receiving from ERP": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD-MMM-YYYY HH:mm:ss').toUpperCase(),
              "Sync Status": 'Successfull',
              "Errors If any": '',
            }

            data.push(obj)
            if (data.length == exportLimit) {
              console.log("---------------------------Limit reached--------child");
              limitReached = true
            }
          }

        }
      }
    }


    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }

    let fileName = 'Po_Received';

    fileName = fileName + '_' + (req.body.exportType == 1 ? 'UID' : 'QTY');

    if (req.body.productId) {
      fileName = fileName + '_' + data[0]['Item Code']
    }

    if (req.body.poId) {
      fileName = fileName + '_' + data[0]['PO No.']
    }

    if (req.body.batchId) {
      fileName = fileName + '_' + data[0]['Batch No.']
    }

    if (packagingLevels.length == 1) {
      fileName = fileName + '_' + packagingLevels[0]
    }

    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm')
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName })

  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ message: error.toString() });
  }
}

async function poSentErpSyncReport(req, res) {
  try {
    let exportType = req.body.exportType;
    let packagingLevels = ['O'];
    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");

    let difference = endDate.diff(startDate, 'days')

    console.log("difference::", difference);


    if (difference < 0) {
      return res.status(200).send({ 'success': 0, message: 'Start date can not be greater than End date' });
    }
    if (difference > 7) {
      return res.status(200).send({ 'success': 0, message: 'Select 7 Days only' });
    }

    startDate = startDate.format('YYYY-MM-DD') + " 00:00:00"
    endDate = endDate.format('YYYY-MM-DD') + " 23:59:59"

    let whereClause = {
      location_id: req.body.locationId,
      createdAt: {
        [Op.between]: [startDate, endDate]
      },
      //is_from_erp: true
    }

    let data = [];

    let productionOrders = await ProductionOrderModel.findAll({
      where: whereClause,
      include: [
        {
          model: LocationModel,
          raw: true
        },
        {
          model: ProductModel,
          raw: true
        },
        {
          model: ProductBatchModel,
          raw: true
        },
      ],
      order: [['createdAt', 'ASC']],
      raw: true,
      nest: true
    })
    let limitReached = false;
    for (let element of productionOrders) {
      if (limitReached) {
        break;
      }

      if (exportType == 1) { // UID
        if (element.status == 3) {

          let transactions = await MappingTransactionModel.findAll({
            where: {
              po_id: element.id,
              packaging_level: 'O'
            },
            include: [
              {
                model: LocationModel,
                raw: true
              },
              {
                model: ProductModel,
                raw: true
              },
              {
                model: ProductBatchModel,
                raw: true
              },
              {
                model: ProductionOrderModel,
                raw: true
              },
            ],
            order: [['createdAt', 'ASC']],
            raw: true,
            nest: true
          })

          for (let item of transactions) {
            if (limitReached) {
              break;
            }
            let erpSyncReason = await ErpTransferModel.findOne({
              where: {
                transaction_id: item.id
              },
              order: [['createdAt', 'ASC']],
            })
            let customModel = await getDynamicModel(item.packaging_level, item.u_id);
            if (customModel) {
              let codes = await customModel.findAll({
                where: {
                  transaction_id: item.id
                },
                order: [['createdAt', 'ASC']],
                raw: true
              })
              if (codes.length > 0) {
                for (let code of codes) {
                  if (limitReached) {
                    break;
                  }
                  if (!code.is_replaced) {
                    if (code.is_mapped || code.is_complete) {
                      if (item.packaging_level == 'O') {
                        let obj = {
                          "Transaction Type": 'PO Sent',
                          "Location Code": item.location.unique_name,
                          "Transaction ID": item.transaction_id,
                          "PO No.": element.po_number,
                          //"PO Date": moment(new Date(element.po_date)).format('DD-MMM-YYYY').toUpperCase(),
                          "Item Code": item.product.sku,
                          "Batch No.": item.product_batch.batch_no,
                          "Unique Code": code.unique_code,
                          //"Mfg Date": moment(new Date(element.mfg_date)).format('DD-MMM-YYYY').toUpperCase(),
                          //"Exp Date": moment(new Date(element.exp_date)).format('DD-MMM-YYYY').toUpperCase(),
                          //"MRP": element.case_mrp,
                          "Qty (cases)": element.mapped_outers,
                          "Final Lot": 'N',
                          "Date & Time of sending to ERP": element.createdAt ? moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD-MMM-YYYY  HH:mm:ss').toUpperCase() : '',
                          "Sync Status": item.erp_sync_status == 0 ? 'Pending' : item.erp_sync_status == 1 ? 'Successfull' : 'Failed',
                          "Errors If any": erpSyncReason ? erpSyncReason.reason : '',
                        }

                        data.push(obj)
                        if (data.length == exportLimit) {
                          console.log("---------------------------Limit reached--------child");
                          limitReached = true
                        }

                      }
                    }
                  }
                }
              }
            }
          }

        }
      } else if (exportType == 2) { // Quantity
        if (element.status == 3) {

          let transactions = await MappingTransactionModel.findAll({
            where: {
              po_id: element.id,
              packaging_level: 'O'
            },
            include: [
              {
                model: LocationModel,
                raw: true
              },
              {
                model: ProductModel,
                raw: true
              },
              {
                model: ProductBatchModel,
                raw: true
              },
              {
                model: ProductionOrderModel,
                raw: true
              },
            ],
            order: [['createdAt', 'ASC']],
            raw: true,
            nest: true
          })

          for (let item of transactions) {
            if (limitReached) {
              break;
            }
            let erpSyncReason = await ErpTransferModel.findOne({
              where: {
                transaction_id: item.id
              },
              order: [['createdAt', 'ASC']],
            })
            if (item.packaging_level == 'O') {
              let obj = {
                "Transaction Type": 'PO Sent',
                "Location Code": item.location.unique_name,
                "Transaction ID": item.transaction_id,
                "PO No.": element.po_number,
                //"PO Date": moment(new Date(element.po_date)).format('DD-MMM-YYYY').toUpperCase(),
                "Item Code": item.product.name,
                "Batch No.": item.product_batch.batch_no,
                //"Mfg Date": moment(new Date(element.mfg_date)).format('DD-MMM-YYYY').toUpperCase(),
                //"Exp Date": moment(new Date(element.exp_date)).format('DD-MMM-YYYY').toUpperCase(),
                //"MRP": element.case_mrp,
                "Qty (cases)": element.mapped_outers,
                "Final Lot": 'N',
                "Date & Time of sending to ERP": element.createdAt ? moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD-MMM-YYYY  HH:mm:ss').toUpperCase() : '',
                "Sync Status": item.erp_sync_status == 0 ? 'Pending' : item.erp_sync_status == 1 ? 'Successfull' : 'Failed',
                "Errors If any": erpSyncReason ? erpSyncReason.reason : '',
              }

              data.push(obj)
              if (data.length == exportLimit) {
                console.log("---------------------------Limit reached--------child");
                limitReached = true
              }

            }
          }

        }
      }
    }


    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }

    let fileName = 'Po_Sent';

    fileName = fileName + '_' + (req.body.exportType == 1 ? 'UID' : 'QTY');

    if (req.body.productId) {
      fileName = fileName + '_' + data[0]['Item Code']
    }

    if (req.body.poId) {
      fileName = fileName + '_' + data[0]['PO No.']
    }

    if (req.body.batchId) {
      fileName = fileName + '_' + data[0]['Batch No.']
    }

    if (packagingLevels.length == 1) {
      fileName = fileName + '_' + packagingLevels[0]
    }

    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm')
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName })

  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ message: error.toString() });
  }
}

async function inventoryReportUIDAndQty(req, res) {
  try {

    // --------------Finding General Models
    let genProductInfo = await getGeneralProductInfo();

    if (!genProductInfo) {
      return res.status(200).send({ success: 0, message: "General Product Not Found" })
    }

    let GeneralModels = {
      PGeneralModel: await getDynamicModel('P', genProductInfo.u_id),
      SGeneralModel: await getDynamicModel('S', genProductInfo.u_id),
      TGeneralModel: await getDynamicModel('T', genProductInfo.u_id),
      OGeneralModel: await getDynamicModel('O', genProductInfo.u_id)
    }
    //-----------------------------------------------------------

    let exportType = req.body.exportType;

    let packagingLevels = ['P', 'S', 'T', 'O'];

    if (req.body.packagingLevel) {
      packagingLevels = [req.body.packagingLevel]
    }

    let data = [];
    let limitReached = false;

    let locationInfo = await LocationModel.findOne({
      where: {
        id: req.body.locationId
      },
      attributes: ['id', 'unique_name'],
      raw: true
    })

    console.log("Sanjay>>>>>", locationInfo)

    if (!locationInfo) {
      return res.status(200).send({ success: 0, message: "Location Not Found" })
    }

    let stockWhereClause = {
      location_id: req.body.locationId,
      packaging_level: {
        [Op.in]: packagingLevels
      }
    }

    if (req.body.productId) {
      stockWhereClause.product_id = req.body.productId;
    }
    if (req.body.batchId) {
      stockWhereClause.batch_id = req.body.batchId;
    }

    let stockSummaries = await StockSummaryModel.findAll({
      where: stockWhereClause,
      include: [
        {
          model: ProductModel,
          attributes: ['id', 'sku', 'u_id'],
          raw: true,
        },
        {
          model: ProductBatchModel,
          attributes: ['id', 'batch_no'],
          raw: true,
        },
        {
          model: StorageBinModel,
          attributes: ['id', 'name'],
          raw: true,
          as: 'bin'
        },
      ],
      order: [['product_id', 'ASC']],
      raw: true,
      nest: true
    })

    console.log("Sanjay stockWhereClause>>>>>", stockWhereClause)
    console.log("Sanjay>>>>>", stockSummaries)

    if (exportType == 2) {
      for (let item of stockSummaries) {
        if (limitReached) {
          break;
        }
        if (item.qty > 0) {
          let obj = {
            "Location ID": locationInfo.unique_name,
            "Item Code": item.product.sku,
            "Batch No.": item.product_batch.batch_no,
            "Packaging Level": item.packaging_level,
            "Bin": item.bin.name,
            "Quantity": item.qty,
          }
          data.push(obj);
        }
        if (data.length == exportLimit) {
          console.log("---------------------------Limit reached--------child");
          limitReached = true
        }
      }
    }
    else {
      let lastUID;
      let lastLevel;
      let CustomModel;

      for (let item of stockSummaries) {
        if (limitReached) {
          break;
        }

        if (item.product.u_id != lastUID || item.packaging_level != lastLevel) {
          lastUID = item.product.u_id;
          lastLevel = item.packaging_level;
          CustomModel = await getDynamicModel(lastLevel, lastUID)
        }

        let GeneralModel = GeneralModels[`${lastLevel}GeneralModel`];


        let allCodes = [];

        let whereClause = {
          storage_bin_id: item.storage_bin,
          [Op.or]: [
            { is_mapped: true },
            { is_active: true },      // parents when gets completed marked as complete and active both.
            // { is_complete: true },
          ],
          is_replaced: false,
          [Op.or]: [
            {
              batch_id: item.batch_id
            },
            {
              assigned_batch_id: item.batch_id
            }
          ]
        };

        let specificCodes = await CustomModel.findAll({
          where: whereClause,
          raw: true,
        })

        let generalCodes = await GeneralModel.findAll({
          where: whereClause,
          raw: true,
        })

        allCodes = [...specificCodes, ...generalCodes];

        for (const element of allCodes) {
          if (limitReached) {
            break;
          }
          let obj = {
            "Location ID": locationInfo.unique_name,
            "Item Code": item.product.sku,
            "Batch No.": item.product_batch.batch_no,
            "UID": element.unique_code,
            "Code Level": lastLevel,
            "Code Type": element.is_open ? 'Open' : element.is_general ? 'General' : 'Specific',
            "Bin": item.bin.name
          }
          data.push(obj);
          if (data.length == exportLimit) {
            limitReached = true
          }
        }

      }
    }

    if (data.length == 0) {
      return res.status(200).send({ success: 0, message: "No Details To Export" })
    }

    let fileName = 'Inventory';

    fileName = fileName + '_' + (req.body.exportType == 1 ? 'UID' : 'QTY');
    if (req.body.productId) {
      fileName = fileName + '_' + data[0]['Item Code']
    }

    if (req.body.batchId) {
      fileName = fileName + '_' + data[0]['Batch No.']
    }

    if (packagingLevels.length == 1) {
      fileName = fileName + '_' + packagingLevels[0]
    }

    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm')
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName })
  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ message: error.toString() });
  }
}

async function getParentChildDetails(codeFound) {
  try {
    let uniqueCode = codeFound.unique_code;
    if (uniqueCode.length != 11) {
      console.log("-------------Must Be Of 11 Characters");
      return { success: 0, message: "Invalid Code," }
    }
    let dynamicCode = uniqueCode[2] + uniqueCode[6] + uniqueCode[8];
    console.log('dynamicCode:::::::::', dynamicCode);
    let dynamicUID = await DynamicUIDModel.findOne({
      where: {
        code: dynamicCode
      },
      order: [['createdAt', 'ASC']],
      raw: true
    })

    if (!dynamicUID) {
      console.log("-------------Dynamic UID Not Found");
      return { success: 0, message: "Invalid Code" }
    }
    let dynamicLevel = await DynamicLevelCodesModel.findOne({
      where: {
        code: uniqueCode[4],
        level: {
          [Op.ne]: null
        }
      },
      order: [['createdAt', 'ASC']],
      raw: true
    })

    if (!dynamicLevel) {
      console.log("-------------,Level Not Found");
      return { success: 0, message: "Invalid Code" }
    }

    let productInfo = await ProductModel.findOne({
      where: {
        u_id: dynamicUID.u_id
      },
      order: [['createdAt', 'ASC']],
      raw: true
    })

    if (!productInfo) {
      return { success: 0, message: "Product Info Not Found" }
    }

    let generalProductInfo = await ProductModel.findOne({
      where: {
        is_general: true
      },
      order: [['createdAt', 'ASC']],
      raw: true
    })

    if (!generalProductInfo) {
      return { success: 0, message: "General Product Not Found" }
    }
    let isGeneral = productInfo.is_general;
    let codeLevel = dynamicLevel.level
    let UIDMrp = '-';
    let caseMRP = !isGeneral ? codeFound.product_batch.mrp : codeFound.assigned_batch.mrp;
    console.log("Case MRP::", caseMRP);
    if (caseMRP) {
      let masterInfo = !isGeneral ? codeFound.product_batch : codeFound.assigned_batch
      let mrpData = await qrcodeController.getCalculatedMRP(masterInfo, caseMRP);
      console.log("---Mrp Calculated", mrpData);

      let varName = codeLevel.toLowerCase() + 'MRP';
      UIDMrp = mrpData[varName];
    }
    let parent = [];
    let childs = [];
    if (!codeFound.is_replaced) {
      if (codeFound.is_mapped) {
        console.log('codeFound.parent_level:::::::::', codeFound.parent_level, codeFound.product.u_id, codeFound.assigned_product.u_id);
        let ParentModel = await getDynamicModel(codeFound.parent_level, !isGeneral ? codeFound.product.u_id : codeFound.assigned_product.u_id);
        if (!ParentModel) {
          console.log('Dynamic Parent Model Not Found');
          return { success: 0, message: 'Dynamic Parent Model Not Found' }
        }
        else {
          let parentCode = await ParentModel.findOne({
            where: {
              id: codeFound.mapped_to_parent
            },
            order: [['createdAt', 'ASC']],
            raw: true
          })
          if (!parentCode) {
            return { success: 0, message: 'Parent Code Not Found' }
          }
          parent.push(parentCode.unique_code)
        }

      }
      if (codeFound.is_complete) {
        let innerLevel;
        let masterInfo = !isGeneral ? codeFound.product_batch : codeFound.assigned_batch;
        if (codeLevel == 'S') {
          if (masterInfo.is_mapp_primary) {
            innerLevel = 'P';
          }
        }
        else if (codeLevel == 'T') {
          if (masterInfo.is_mapp_secondary) {
            innerLevel = 'S';
          }
          else if (masterInfo.is_mapp_primary) {
            innerLevel = 'P'
          }
        }
        else if (codeLevel == 'O') {
          if (masterInfo.is_mapp_tertiary) {
            innerLevel = 'T';
          } else if (masterInfo.is_mapp_secondary) {
            innerLevel = 'S';
          } else if (masterInfo.is_mapp_primary) {
            innerLevel = 'P';
          }
        }

        if (innerLevel) {
          let ChildModel, GeneralChildModel;
          GeneralChildModel = await getDynamicModel(innerLevel, generalProductInfo.u_id);

          if (!isGeneral) {
            ChildModel = await getDynamicModel(innerLevel, codeFound.product.u_id);
            console.log("--------------------General Product Found----------------");
          }
          else {   // General code
            ChildModel = await getDynamicModel(innerLevel, codeFound.assigned_product?.u_id);   // UID of asssigned product
          }
          if (!ChildModel || !GeneralChildModel) {
            return { success: 0, message: `Child Model (${!ChildModel ? 'Specific' : 'General'}) Not Found` }
          }
          // Updating parents of specific children
          let childCodes = await ChildModel.findAll({
            where: {
              is_replaced: false,
              mapped_to_parent: codeFound.id    // Previous Parent 
            },
            order: [['createdAt', 'ASC']],
            raw: true
          })

          // // Updating parents of general children
          let generalChildCodes = await GeneralChildModel.findAll({
            where: {
              is_replaced: false,
              mapped_to_parent: codeFound.id    // Previous Parent 
            },
            order: [['createdAt', 'ASC']],
            raw: true
          })

          let allChilds = [...childCodes, ...generalChildCodes];

          allChilds.forEach(element => {
            childs.push(element.unique_code)
          });
        }
        else {
          console.log("----------Inner Level Not Found------------");
        }
      }
    }
    console.log('UIDMrp:::::::::::', UIDMrp);
    let obj = {
      parent: parent,
      child: childs,
      UIDMrp: UIDMrp
    }
    return { success: 1, data: obj }
  } catch (error) {
    console.log(error)
    return { success: 0, message: 'internal error' };
  }
}

async function getDynamicModel(key, UID) {
  try {
    console.log("-------key", key);
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

async function getGeneralProductInfo() {
  try {
    let data = await ProductModel.findOne({
      where: {
        is_general: true
      },
      raw: true
    })
    return data;
  } catch (error) {
    return false;
  }
}

async function codeGenerationReport(req, res) {
  try {
    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");
    let difference = endDate.diff(startDate, 'days');
    console.log("difference::", difference);
    if (difference < 0) {
      return res.status(200).send({ 'success': 0, 'message': 'Start date can not be greater than End date' });
    }
    if (difference > 31) {
      return res.status(200).send({ 'success': 0, 'message': 'Select 31 Days only' });
    }
    startDate = startDate.format('YYYY-MM-DD') + " 00:00:00";
    endDate = endDate.format('YYYY-MM-DD') + " 23:59:59";
    let whereClause = {};
    if (req.body.locationId.length > 1) {
      let locationArray = req.body.locationId.map((x) => {
        return (x.item_id)
      })
      whereClause = {
        manufactured_by: {
          [Op.in]: locationArray
        },
        createdAt: {
          [Op.between]: [startDate, endDate]
        },
        status: true,
        is_approved: true
      }
    } else {
      whereClause = {
        manufactured_by: req.body.locationId[0].item_id,
        createdAt: {
          [Op.between]: [startDate, endDate]
        },
        status: true,
        is_approved: true
      }
    }
    let data = [];
    let limitReached = false;
    let parents = await TrustedQrCodeParent.findAll({
      where: whereClause,
      attributes: ["id", "product_id", "total_qrcode", "status", "createdAt", "manufactured_by", "manufactured_in", "consignment_id", "is_approved", "is_started", "created_by"],
      include: [
        {
          model: Product,
          attributes: ["id", "name", "createdAt", "sku", "u_id", "category_id", "warranty_period", "ean_code", "brand", "calibre_id", "case_no", "gender", "movement_type"],
          include: [
            {
              model: CompanyBrands,
              attributes: ["id", "name"]
            },
            {
              model: calibreModel,
              attributes: ["id", "name"]
            },
            {
              model: MovementTypeModel,
              attributes: ["id", "name"],
              as: 'MovementType'
            },
            {
              model: ProductCategory,
              attributes: ["id", "name"]
            }
          ]
        },
        {
          model: ConsignmentModel,
          attributes: ['id', 'consignment_no']
        },
        {
          model: LocationModel,
          attributes: ['id', 'unique_name', 'name'],
          as: 'location'
        }
      ],
      raw: true,
      nest: true,
      order: [
        ['createdAt', 'ASC'],
      ]
      //limit: 1000
    })
    console.log('parents:::::::::::::', parents.length, parents[0]);
    for (let element of parents) {
      if (limitReached) {
        break;
      }
      // let table_id = "trusted_qrcodes_" + element.product.u_id.toLowerCase();
      // let trusted_qrcodes = await DynamicModels.getModel(table_id);
      let codes = await CompanySerialCodes.findAll({
        where: {
          trusted_qrcode_parent_id: element.id,
          is_generated: true  // if Status is true then code is generated
        },
        raw: true,
        nest: true,
        order: [
          ['createdAt', 'ASC'],
        ]
      })
      if (codes.length > 0) {
        for (let item of codes) {
          if (limitReached) {
            break
          }
          let obj = {
            "Consignment No.": element.consignment.consignment_no,
            "Item Code": element.product.sku,
            "Serial No.": item.serial_no,
            "Batch No.": item.batch_no,
            "Collection": element.product.product_category.name,
            "Movement": element.product.MovementType.name,
            "Brand Name": element.product.company_brand.name,
            "EAN Code": element.product.ean_code,
            "Gender": element.product.gender,
            "Warehouse ID": element.location.unique_name,
            "Date of Generation": moment(new Date(item.createdAt)).tz('Asia/kolkta').format('DD/MMM/YYYY').toUpperCase()
          }

          data.push(obj)
          if (data.length == exportLimit) {
            limitReached = true
          }
        }
      }
    }
    console.log("---------------Lenght", data.length);

    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }
    let fileName = 'Code_Generation_Report';
    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm')
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName })
  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ message: error.toString() });
  }
}

async function stockOutwardReport(req, res) {
  try {
    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");
    let difference = endDate.diff(startDate, 'days');
    console.log("difference::", difference);
    if (difference < 0) {
      return res.status(200).send({ 'success': 0, 'message': 'Start date can not be greater than End date' });
    }
    if (difference > 31) {
      return res.status(200).send({ 'success': 0, 'message': 'Select 31 Days only' });
    }
    startDate = startDate.format('YYYY-MM-DD') + " 00:00:00";
    endDate = endDate.format('YYYY-MM-DD') + " 23:59:59";
    let whereClause = {};

    if (req.body.toLocationId.length > 1) {

      let toLocationArray = req.body.toLocationId.map((x) => {
        return (x.item_id)
      })

      whereClause = {
        from_location: req.body.fromLocationId[0].item_id,
        to_location: {
          [Op.in]: toLocationArray
        },
        order_date: {
          [Op.between]: [startDate, endDate]
        },
        [Op.or]: [
          { order_type: 1 }, { order_type: 2 }
        ],
        status: {
          [Op.in]: [1, 2, 3, 4, 5, 6, 7]
        }
      }
    } else {
      whereClause = {
        from_location: req.body.fromLocationId[0].item_id,
        to_location: req.body.toLocationId[0].item_id,
        order_date: {
          [Op.between]: [startDate, endDate]
        },
        [Op.or]: [
          { order_type: 1 }, { order_type: 2 }
        ],
        status: {
          [Op.in]: [1, 2, 3, 4, 5, 6, 7]
        }
      }
    }

    console.log("whereCluse....." + whereClause)
    let data = [];
    let limitReached = false;
    let orders = await OrderModel.findAll({
      where: whereClause,
      // attributes: ["id", "delivery_no", "order_no", "from_location", "to_location", "order_date", "status", "order_type", "ref_invoice_no", "createdAt", "finance_location_id"],
      include: [
        {
          model: LocationModel,
          attributes: ['id', 'unique_name', 'name'],
          as: 'from',
        },
        {
          model: LocationModel,
          attributes: ['id', 'unique_name', 'name'],
          as: 'to',
        }
      ],
      raw: true,
      nest: true,
      order: [
        ['createdAt', 'ASC'],
      ]
    })

    for (let element of orders) {
      if (limitReached) {
        break;
      }
      let OrderDetailsModel = await DynamicModels.getOrderDetailsModel(element.o_uid)
      let allOrderDetails = await OrderDetailsModel.findAll({
        where: {
          order_id: element.id
        },
        attributes: ["id", "order_id", "qty"],
        include: [
          {
            model: ProductModel,
            attributes: ["id", "name", "createdAt", "sku", "u_id"],
          },
          {
            model: ProductBatchModel,
            attributes: ["id", "batch_no"],
          }
        ]
      })


      for (const itm of allOrderDetails) {

        let obj = {
          "Order No.": element.order_no,
          "Delivery No.": element.delivery_no,
          "Item Code": itm.product.sku,
          "Batch No.": itm.product_batch.batch_no,
          // "Delivery No." : element.delivery_no,
          // "EAN Code": itm.product.ean_code,
          // "Gender": itm.product.gender,
          "From Location": element.from.unique_name,
          "TO Location": element.to.unique_name,
          "Qty": itm.qty,
          // "TO Location Name": element.to.name,
          "Bill To": element.bill_location,
          "Status": statusList[element.status],
          "Date of Outward": moment(new Date(element.createdAt)).tz('Asia/kolkta').format('DD/MMM/YYYY').toUpperCase()
        }

        data.push(obj)
        if (data.length == exportLimit) {
          limitReached = true
        }
      }
    }


    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }
    let fileName = 'Stock_Outward_Report';
    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm')
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName })
  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ message: error.toString() });
  }
}

async function salesOrderReport(req, res) {
  try {
    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");
    let difference = endDate.diff(startDate, 'days');
    console.log("difference::", difference);
    if (difference < 0) {
      return res.status(200).send({ 'success': 0, 'message': 'Start date can not be greater than End date' });
    }
    if (difference > 31) {
      return res.status(200).send({ 'success': 0, 'message': 'Select 31 Days only' });
    }
    startDate = startDate.format('YYYY-MM-DD') + " 00:00:00";
    endDate = endDate.format('YYYY-MM-DD') + " 23:59:59";
    let whereClause = {};

    if (req.body.toLocationId.length > 1) {

      let toLocationArray = req.body.toLocationId.map((x) => {
        return (x.item_id)
      })

      whereClause = {
        from_location: req.body.fromLocationId[0].item_id,
        to_location: {
          [Op.in]: toLocationArray
        },
        order_date: {
          [Op.between]: [startDate, endDate]
        },
        [Op.or]: [
          { order_type: 1 }, { order_type: 2 }
        ],
        status: {
          [Op.in]: [1, 2, 3, 4, 5, 6, 7, 8, 10]
        }
      }
    } else {
      whereClause = {
        from_location: req.body.fromLocationId[0].item_id,
        to_location: req.body.toLocationId[0].item_id,
        order_date: {
          [Op.between]: [startDate, endDate]
        },
        [Op.or]: [
          { order_type: 1 }, { order_type: 2 }
        ],
        status: {
          [Op.in]: [1, 2, 3, 4, 5, 6, 7, 8, 10]
        }
      }
    }

    console.log("whereCluse sales order....." + whereClause)
    let data = [];
    let limitReached = false;
    let orders = await OrderModel.findAll({
      where: whereClause,
      // attributes: ["id", "delivery_no", "order_no", "from_location", "to_location", "order_date", "status", "order_type", "ref_invoice_no", "createdAt", "finance_location_id"],
      include: [
        {
          model: LocationModel,
          attributes: ['id', 'unique_name', 'name'],
          as: 'from',
        },
        {
          model: LocationModel,
          attributes: ['id', 'unique_name', 'name'],
          as: 'to',
        }
      ],
      raw: true,
      nest: true,
      order: [
        ['createdAt', 'ASC'],
      ]
    })

    for (let element of orders) {
      if (limitReached) {
        break;
      }
      let OrderDetailsModel = await DynamicModels.getOrderDetailsModel(element.o_uid)
      let allOrderDetails = await OrderDetailsModel.findAll({
        where: {
          order_id: element.id
        },
        attributes: ["id", "order_id", "qty"],
        include: [
          {
            model: ProductModel,
            attributes: ["id", "name", "createdAt", "sku", "u_id"],
          },
          {
            model: ProductBatchModel,
            attributes: ['id', 'batch_no'],

          }
        ]
      })


      for (const itm of allOrderDetails) {

        let obj = {
          "Order No.": element.order_no,
          "Delivery No.": element.delivery_no,
          "Item Code": itm.product.sku,
          "Batch No.": itm.product_batch.batch_no,
          // "EAN Code": itm.product.ean_code,
          // "Gender": itm.product.gender,
          "From Location": element.from.unique_name,
          "TO Location": element.to.unique_name,
          "Qty": itm.qty,
          // "TO Location Name": element.to.name,
          "Bill To": element.bill_location,
          "Status": statusList[element.status],
          "Date of Order": moment(new Date(element.createdAt)).tz('Asia/kolkta').format('DD/MMM/YYYY').toUpperCase()
        }

        data.push(obj)
        if (data.length == exportLimit) {
          limitReached = true
        }
      }
    }


    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }
    let fileName = 'Sales_Order_Report';
    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm')
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName })
  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ message: error.toString() });
  }
}

async function salesReturnReport(req, res) {
  try {
    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");
    let difference = endDate.diff(startDate, 'days');
    console.log("difference::", difference);
    if (difference < 0) {
      return res.status(200).send({ 'success': 0, 'message': 'Start date can not be greater than End date' });
    }
    if (difference > 31) {
      return res.status(200).send({ 'success': 0, 'message': 'Select 31 Days only' });
    }
    startDate = startDate.format('YYYY-MM-DD') + " 00:00:00";
    endDate = endDate.format('YYYY-MM-DD') + " 23:59:59";
    let whereClause = {};
    if (req.body.fromLocationId.length > 1) {
      let fromLocationArray = req.body.fromLocationId.map((x) => {
        return (x.item_id)
      })
      whereClause = {
        from_location: {
          [Op.in]: fromLocationArray
        },
        to_location: req.body.toLocationId[0].item_id,
        order_date: {
          [Op.between]: [startDate, endDate]
        },
        order_type: 3,
        // [Op.or]: [
        //     { order_type: 1 }, { order_type: 3 },
        // ],
        status: {
          [Op.in]: [1, 5, 6]
        }
      }
    } else {
      whereClause = {
        from_location: req.body.fromLocationId[0].item_id,
        to_location: req.body.toLocationId[0].item_id,
        order_date: {
          [Op.between]: [startDate, endDate]
        },
        [Op.or]: [
          { order_type: 1 }, { order_type: 3 },
        ],
        status: {
          [Op.in]: [1, 5, 6]
        }
      }
    }
    let data = [];
    let limitReached = false;
    let orders = await OrderModel.findAll({
      where: whereClause,
      // attributes: ["id", "delivery_no", "order_no", "from_location", "to_location", "order_date", "status", "order_type", "ref_invoice_no", "createdAt", "finance_location_id"],
      include: [
        {
          model: LocationModel,
          attributes: ['id', 'unique_name', 'name'],
          as: 'from',

        },
        {
          model: LocationModel,
          attributes: ['id', 'unique_name', 'name'],
          as: 'to',

        }
      ],
      raw: true,
      nest: true,
      order: [
        ['createdAt', 'ASC'],
      ]
    })
    console.log('orders:::::::::::::', orders.length, orders[0]);
    for (let element of orders) {
      if (limitReached) {
        break;
      }

      let OrderDetailsModel = await DynamicModels.getOrderDetailsModel(element.o_uid)

      let allOrderDetails = await OrderDetailsModel.findAll({
        where: {
          order_id: element.id
        },
        attributes: ["id", "order_id", "qty"],
        include: [
          {
            model: ProductModel,
            attributes: ["id", "name", "createdAt", "sku", "u_id"],

          },
          {
            model: ProductBatchModel,
            attributes: ['id', 'batch_no'],

          }
        ]
      })



      for (const itm of allOrderDetails) {
        //   let codes = await InwardScannedLvl1Codes.findAll({
        //     where: {
        //       order_id: element.id,
        //       order_details_id: itm.id
        //     },
        //     raw: true,
        //     nest: true,
        //     order: [
        //       ['createdAt', 'ASC'],
        //     ]
        //   })
        //   console.log(">>>>>>>>>>>Codes", codes.length);
        //   if (codes.length > 0) {
        //     for (let item of codes) {
        //       if (limitReached) {
        //         break
        //       }
        let obj = {
          "Order No.": element.order_no,
          "Delivery No.": element.delivery_no,
          "Item Code": itm.product.sku,
          "Batch No.": itm.product_batch.batch_no,
          "From Location": element.from.unique_name,
          // // "From To Partner Type": element.from.channel_type.name,
          // "From To Partner Name": element.from.channel.name,
          // "From To Partner Location Name": element.from.name,
          "To Location": element.to.unique_name,
          "Qty": itm.qty,
          // "To Partner Type": element.to.channel_type.name,
          // "To Partner Name": element.to.channel.name,
          // "To Partner Location Name": element.to.name,
          // "Collection": itm.product.product_category.name,
          // "Movement": itm.product.MovementType.name,
          // "Brand Name": itm.product.company_brand.name,
          // "EAN Code": itm.product.ean_code,
          // "Gender": itm.product.gender,
          "Status": statusList[element.status],
          "Date of Return": moment(new Date(element.createdAt)).tz('Asia/kolkta').format('DD/MMM/YYYY').toUpperCase()
        }

        data.push(obj)
        if (data.length == exportLimit) {
          limitReached = true
        }
      }
    }

    console.log("---------------Lenght", data.length);

    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }
    let fileName = 'Sales_Return_Report';
    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm');
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName });
  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ message: error.toString() });
  }
}

async function stockInwartdReport(req, res) {
  try {
    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");
    let difference = endDate.diff(startDate, 'days');
    console.log("difference::", difference);
    if (difference < 0) {
      return res.status(200).send({ 'success': 0, 'message': 'Start date can not be greater than End date' });
    }
    if (difference > 31) {
      return res.status(200).send({ 'success': 0, 'message': 'Select 31 Days only' });
    }
    startDate = startDate.format('YYYY-MM-DD') + " 00:00:00";
    endDate = endDate.format('YYYY-MM-DD') + " 23:59:59";
    let whereClause = {};
    if (req.body.fromLocationId.length > 1) {
      let fromLocationArray = req.body.fromLocationId.map((x) => {
        return (x.item_id)
      })
      whereClause = {
        from_location: {
          [Op.in]: fromLocationArray
        },
        to_location: req.body.toLocationId[0].item_id,
        order_date: {
          [Op.between]: [startDate, endDate]
        },
        order_type: 3,
        // [Op.or]: [
        //     { order_type: 1 }, { order_type: 3 },
        // ],
        status: {
          [Op.in]: [9, 10]
        }
      }
    } else {
      whereClause = {
        from_location: req.body.fromLocationId[0].item_id,
        to_location: req.body.toLocationId[0].item_id,
        order_date: {
          [Op.between]: [startDate, endDate]
        },
        [Op.or]: [
          { order_type: 1 }, { order_type: 3 },
        ],
        status: {
          [Op.in]: [6]
        }
      }
    }
    let data = [];
    let limitReached = false;
    let orders = await OrderModel.findAll({
      where: whereClause,
      // attributes: ["id", "delivery_no", "order_no", "from_location", "to_location", "order_date", "status", "order_type", "ref_invoice_no", "createdAt", "finance_location_id"],
      include: [
        {
          model: LocationModel,
          attributes: ['id', 'unique_name', 'name'],
          as: 'from',

        },
        {
          model: LocationModel,
          attributes: ['id', 'unique_name', 'name'],
          as: 'to',

        }
      ],
      raw: true,
      nest: true,
      order: [
        ['createdAt', 'ASC'],
      ]
    })
    console.log('orders:::::::::::::', orders.length, orders[0]);
    for (let element of orders) {
      if (limitReached) {
        break;
      }

      let OrderDetailsModel = await DynamicModels.getOrderDetailsModel(element.o_uid)

      let allOrderDetails = await OrderDetailsModel.findAll({
        where: {
          order_id: element.id
        },
        attributes: ["id", "order_id", "qty"],
        include: [
          {
            model: ProductModel,
            attributes: ["id", "name", "createdAt", "sku", "u_id"],

          },
          {
            model: ProductBatchModel,
            attributes: ["id", "batch_no"],
          }
        ]
      })



      for (const itm of allOrderDetails) {

        let obj = {
          "Order No.": element.order_no,
          "Delivery No.": element.delivery_no,
          "Item Code": itm.product.sku,
          // "Serial No.": item.serial_no,
          "Batch No.": itm.product_batch.batch_no,
          "From Location": element.from.unique_name,
          // // "From To Partner Type": element.from.channel_type.name,
          // "From To Partner Name": element.from.channel.name,
          // "From To Partner Location Name": element.from.name,
          "To Location": element.to.unique_name,
          "Qty": itm.qty,
          // "To Partner Type": element.to.channel_type.name,
          // "To Partner Name": element.to.channel.name,
          // "To Partner Location Name": element.to.name,
          // "Collection": itm.product.product_category.name,
          // "Movement": itm.product.MovementType.name,
          // "Brand Name": itm.product.company_brand.name,
          // "EAN Code": itm.product.ean_code,
          // "Gender": itm.product.gender,
          "Date of Return": moment(new Date(element.createdAt)).tz('Asia/kolkta').format('DD/MMM/YYYY').toUpperCase()
        }

        data.push(obj)
        if (data.length == exportLimit) {
          limitReached = true
        }
      }
    }
    //   }
    // }
    console.log("---------------Lenght", data.length);

    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }
    let fileName = 'Stock_Inward_Report';
    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm');
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName });
  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ message: error.toString() });
  }
}

async function InventoryReport(req, res) {
  try {
    let whereClause = {};
    if (req.body.locationId.length > 1) {
      let locationArray = req.body.locationId.map((x) => {
        return (x.item_id)
      })
      whereClause = {
        location_id: {
          [Op.in]: locationArray
        },
      }
    } else {
      whereClause = {
        location_id: req.body.locationId[0].item_id
      }
    }

    let data = [];
    let limitReached = false;
    let stockSummary = await StockSummary.findAll({
      where: whereClause,
      attributes: ['id', 'location_id', 'storage_bin', 'product_id', 'qty', 'packaging_level', 'createdAt'],
      include: [
        {
          model: ProductModel,
          attributes: ["id", "name", "createdAt", "sku", "u_id"],

        },
        {
          model: StorageBinModel,
          raw: true,
          attributes: ['id', 'name'],
          as: 'bin'
        },
        {
          model: LocationModel,
          attributes: ['id', 'unique_name', 'name'],

        }
      ],
      raw: true,
      nest: true,
      order: [
        ['createdAt', 'ASC'],
      ]
    });

    for (let element of stockSummary) {
      if (limitReached) {
        break;
      }
      if (element.qty != 0) {
        let obj = {
          "Item Code": element.product.sku,
          // "Collection": element.product.product_category.name,
          // "Movement": element.product.MovementType.name,
          // "Brand Name": element.product.company_brand.name,
          // "EAN Code": element.product.ean_code,
          // "Gender": element.product.gender,
          "Packaging Level": element.packaging_level,
          "Quantity": element.qty,
          "Storage Bin": element.bin.name,
          "Location ID": element.location.unique_name,

          // "Partner Type": element.location.channel_type.name,
          // "Partner Name": element.location.channel.name,
          "Partner Location Name": element.location.name,
          "Date of Inventory": moment(new Date(element.createdAt)).tz('Asia/kolkta').format('DD/MMM/YYYY').toUpperCase()
        }

        data.push(obj)
        if (data.length == exportLimit) {
          limitReached = true
        }
      }
    }
    console.log("---------------Lenght", data.length);

    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }
    let fileName = 'Inventory_Report';
    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm')
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName })

  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ message: error.toString() });
  }
}

//sql query function
async function querySQl(Condition) {
  const data = await db.sequelize.query(Condition, { type: db.Sequelize.QueryTypes.SELECT, raw: true });
  return data.flat();
}

async function warrantyActivationReport(req, res) {
  try {
    let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
    let endDate = moment(req.body.toDate, "YYYY-MM-DD");
    let difference = endDate.diff(startDate, 'days');
    console.log("difference::", difference);
    if (difference < 0) {
      return res.status(200).send({ 'success': 0, 'message': 'Start date can not be greater than End date' });
    }
    if (difference > 31) {
      return res.status(200).send({ 'success': 0, 'message': 'Select 31 Days only' });
    }
    startDate = startDate.format('YYYY-MM-DD') + " 00:00:00";
    endDate = endDate.format('YYYY-MM-DD') + " 23:59:59";
    let whereClause = {};
    // if (req.body.locationId.length > 1) {
    let productArray = req.body.productId.map((x) => {
      return (x.item_id)
    })
    whereClause = {
      createdAt: {
        [Op.between]: [startDate, endDate]
      },
      product_id: {
        [Op.in]: productArray
      },
      action: true,  // Only Warranty Activation History Not both
    }
    // } else {
    //     whereClause = {
    //         createdAt: {
    //             [Op.between]: [startDate, endDate]
    //         },
    //         product_id: req.body.productId[0].item_id
    //     }
    // }
    let data = [];
    let limitReached = false;
    let warranties = await WarrantyHistory.findAll({
      where: whereClause,
      attributes: ['id', 'code', 'code_id', 'product_id', 'action', 'expires_by', 'status', 'user_id', 'action_at', 'action_by', 'has_deviation', 'previous_bin', 'createdAt', 'updatedAt', 'serial_no'],
      include: [
        {
          model: CompanyUser,
          attributes: ['id', 'name', 'mobile_no'],
          include: [
            {
              model: LocationModel,
              attributes: ['id', 'name'],
              raw: true,
              nest: true
            }
          ],
          raw: true,
          nest: true
        },
        {
          model: Product,
          attributes: ["id", "name", "createdAt", "sku", "u_id", "category_id", "warranty_period", "ean_code", "brand", "calibre_id", "case_no", "gender", "movement_type"],
          include: [
            {
              model: CompanyBrands,
              attributes: ["id", "name"]
            },
            {
              model: calibreModel,
              attributes: ["id", "name"]
            },
            {
              model: MovementTypeModel,
              attributes: ["id", "name"],
              as: 'MovementType'
            },
            {
              model: ProductCategory,
              attributes: ["id", "name"]
            }
          ]
        }
      ],
      raw: true,
      nest: true,
      order: [
        ['createdAt', 'ASC'],
      ]
    })

    req.body.locationId = req.body.locationId.map((x) => {
      return (x.item_id)
    })
    warranties = await warranties.filter((x) => req.body.locationId.includes(String(x.company_user.location.id)));

    let lastUID;
    let CustomModel;
    for (let element of warranties) {
      if (limitReached) {
        break;
      }
      let UID = element.product.u_id.toLowerCase();
      if (UID != lastUID) {
        lastUID = UID;
        let table_id = "trusted_qrcodes_" + UID;
        CustomModel = await DynamicModels.getModel(table_id);
      }
      let code = await CustomModel.findOne({
        where: {
          serial_no: element.serial_no
        },
        attributes: ['id', 'batch_no'],
        order: [
          ['createdAt', 'ASC'],
        ]
      });
      let obj = {
        "Partner Type": element.company_user.location.channel_type.name,
        "Partner Name": element.company_user.location.channel.name,
        "Partner Location Name": element.company_user.location.name,
        "Retailer User ID": element.company_user.name,
        "Mobile No.": element.company_user.mobile_no,
        "Item Code": element.product.sku,
        "Serial No.": element.serial_no,
        "Batch No.": code.batch_no,
        "Collection": element.product.product_category.name,
        "Movement": element.product.MovementType.name,
        "Brand Name": element.product.company_brand.name,
        "EAN Code": element.product.ean_code,
        "Gender": element.product.gender,
        "Activation Date": moment(element.createdAt).format('DD/MMM/YYYY').toUpperCase()
      }

      data.push(obj)
      if (data.length == exportLimit) {
        limitReached = true
      }

    }

    if (data.length <= 0) {
      return res.status(200).send({ success: 0, message: 'No Details To Export' });
    }
    let fileName = 'Warranty_Activations_Report';
    let dateString = moment().utcOffset("+05:30").format('DD_MM_YYYY_HH_mm');
    fileName = fileName + '_' + dateString + '.xlsx';
    return res.status(200).send({ success: 1, data: data, fileName: fileName });
  } catch (error) {
    console.log(error);
    logger.error(req, error.message);
    return res.status(500).send({ message: error.toString() });
  }
}


module.exports = stock_report;