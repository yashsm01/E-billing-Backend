const v = require("node-input-validator");
const sequelize = require("sequelize");
const { Op } = require("sequelize");
const moment = require('moment');
const logger = require("../helpers/logger");
const parseValidate = require("../middleware/parseValidate");
const qrcodeController = require('../controllers/qr-codes-controller');
const DynamicModels = require('../models/dynamic_models');
const commonController = require("./common");
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
          2 Mapping
          3 Non QR to QR
          4 Replace Codes

          exportType:
          1 UID
          2 QTY
          3 With Parent Child Codes
      */

      if (req.body.transactionType == 1) {
        if (req.body.exportType == 1) {
          await codeGenerationQTYReport(req, res)
        }
        else if (req.body.exportType == 2) {
          await codeGenerationQTYReport(req, res)
        }
        else if (req.body.exportType == 3) {
          await codeGenerationQTYReport(req, res);
        }
        else {
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
          [Op.or]: [
            { is_mapped: true },
            { is_active: true },
            { is_complete: true },
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
        productId: "required",
        batchId: "required",
        //packagingLevel: "required|in:P,S,T,O",
        exportType: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
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
  }
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

    console.log("----whereclause::", whereClause);

    let data = [];
    let limitReached = false;
    for (let level of packagingLevels) {
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
      }
      if (parents.length > 0) {

        if (exportType == 2) {   // Quantity
          for (let element of parents) {
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
            let CustomModel = await getDynamicModel(level, parent.product.u_id);
            CustomModel.hasOne(MappingTransactionModel, {
              foreignKey: 'id',
              sourceKey: 'mapp_transaction_id',
              as: 'transaction'
            })

            CustomModel.hasOne(MappingTransactionModel, {
              foreignKey: 'id',
              sourceKey: 'transaction_id',
              as: 'mapping_transaction'
            })

            CustomModel.hasOne(CompanyUser, {
              foreignKey: 'id',
              sourceKey: 'replaced_by',
              as: 'replaced_by_user'
            })

            CustomModel.hasOne(ProductionOrderModel, {
              foreignKey: 'id',
              sourceKey: 'po_id'
            })
            let codes = await CustomModel.findAll({
              where: {
                parent_id: parent.id
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
              nest: true
            })
            if (codes.length > 0) {
              for (let element of codes) {
                if (limitReached) {
                  break
                }
                let details = await getParentChildDetails(element, res);
                if (details.success == 1) {
                  let obj = {
                    "Transaction Type": "Code Generation",
                    "Transaction Date": moment(new Date(parent.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
                    "Location": parent.location.unique_name,
                    "Item Code": parent.product.sku,
                    "PO No.": parent.production_order.po_number,
                    "Batch No.": parent.product_batch.batch_no,
                    "MRP": details.data.UIDMrp ? details.data.UIDMrp : '',
                    "Packaging Level": level,
                    "Unique Code": element.unique_code,
                    "Parent": details.data.parent.toString(),
                    "Child": details.data.child.toString(),
                  }

                  data.push(obj)
                }
                if (data.length == exportLimit) {
                  limitReached = true
                }
              }
            }
          }
        }

      }
    }
    //console.log("Data::", data);

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
      is_other: isOther,
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
    for (let element of transactions) {
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

        // if (SpecificModel) {
        //     SpecificModel.hasOne(MappingTransactionModel, {
        //         foreignKey: 'id',
        //         sourceKey: 'mapp_transaction_id',
        //         as: 'transaction'
        //     })

        //     SpecificModel.hasOne(MappingTransactionModel, {
        //         foreignKey: 'id',
        //         sourceKey: 'transaction_id',
        //         as: 'mapping_transaction'
        //     })

        //     SpecificModel.hasOne(CompanyUser, {
        //         foreignKey: 'id',
        //         sourceKey: 'replaced_by',
        //         as: 'replaced_by_user'
        //     })

        //     SpecificModel.hasOne(ProductionOrderModel, {
        //         foreignKey: 'id',
        //         sourceKey: 'po_id'
        //     })
        // }
        // if (GeneralModel) {
        //     GeneralModel.hasOne(MappingTransactionModel, {
        //         foreignKey: 'id',
        //         sourceKey: 'mapp_transaction_id',
        //         as: 'transaction'
        //     })

        //     GeneralModel.hasOne(MappingTransactionModel, {
        //         foreignKey: 'id',
        //         sourceKey: 'transaction_id',
        //         as: 'mapping_transaction'
        //     })

        //     GeneralModel.hasOne(CompanyUser, {
        //         foreignKey: 'id',
        //         sourceKey: 'replaced_by',
        //         as: 'replaced_by_user'
        //     })

        //     GeneralModel.hasOne(ProductionOrderModel, {
        //         foreignKey: 'id',
        //         sourceKey: 'po_id'
        //     })
        // }
        // if (ChildModel) {
        //     ChildModel.hasOne(MappingTransactionModel, {
        //         foreignKey: 'id',
        //         sourceKey: 'mapp_transaction_id',
        //         as: 'transaction'
        //     })

        //     ChildModel.hasOne(MappingTransactionModel, {
        //         foreignKey: 'id',
        //         sourceKey: 'transaction_id',
        //         as: 'mapping_transaction'
        //     })

        //     ChildModel.hasOne(CompanyUser, {
        //         foreignKey: 'id',
        //         sourceKey: 'replaced_by',
        //         as: 'replaced_by_user'
        //     })

        //     ChildModel.hasOne(ProductionOrderModel, {
        //         foreignKey: 'id',
        //         sourceKey: 'po_id'
        //     })
        // }

        let specificCodes = await SpecificModel.findAll({
          where: {
            transaction_id: element.id,
          },
          // include: [
          //     {
          //         model: ProductModel,
          //         as: 'product',
          //         raw: true,
          //     },
          //     {
          //         model: ProductModel,
          //         as: 'assigned_product',
          //         raw: true,
          //     },
          //     {
          //         model: ProductionOrderModel,
          //         raw: true
          //     },

          //     {
          //         model: ProductBatchModel,
          //         as: 'product_batch',
          //         raw: true,
          //     },
          //     {
          //         model: ProductBatchModel,
          //         as: 'assigned_batch',
          //         raw: true,
          //     },

          //     {
          //         model: MappingTransactionModel,
          //         raw: true,
          //         as: 'mapping_transaction'
          //     },
          //     {
          //         model: MappingTransactionModel,
          //         raw: true,
          //         as: 'transaction'
          //     },
          //     {
          //         model: CompanyUser,
          //         raw: true,
          //         as: 'replaced_by_user'
          //     }

          // ],
          order: [['createdAt', 'ASC']],
          raw: true,
          nest: true
          //limit: 1000
        })
        let generalCodes = [];
        if (GeneralModel) {
          generalCodes = await GeneralModel.findAll({
            where: {
              transaction_id: element.id,
            },
            // include: [
            //     {
            //         model: ProductModel,
            //         as: 'product',
            //         raw: true,
            //     },
            //     {
            //         model: ProductModel,
            //         as: 'assigned_product',
            //         raw: true,
            //     },
            //     {
            //         model: ProductionOrderModel,
            //         raw: true
            //     },

            //     {
            //         model: ProductBatchModel,
            //         as: 'product_batch',
            //         raw: true,
            //     },
            //     {
            //         model: ProductBatchModel,
            //         as: 'assigned_batch',
            //         raw: true,
            //     },

            //     {
            //         model: MappingTransactionModel,
            //         raw: true,
            //         as: 'mapping_transaction'
            //     },
            //     {
            //         model: MappingTransactionModel,
            //         raw: true,
            //         as: 'transaction'
            //     },
            //     {
            //         model: CompanyUser,
            //         raw: true,
            //         as: 'replaced_by_user'
            //     }

            // ],
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
            // include: [
            //     {
            //         model: ProductModel,
            //         as: 'product',
            //         raw: true,
            //     },
            //     {
            //         model: ProductModel,
            //         as: 'assigned_product',
            //         raw: true,
            //     },
            //     {
            //         model: ProductionOrderModel,
            //         raw: true
            //     },

            //     {
            //         model: ProductBatchModel,
            //         as: 'product_batch',
            //         raw: true,
            //     },
            //     {
            //         model: ProductBatchModel,
            //         as: 'assigned_batch',
            //         raw: true,
            //     },

            //     {
            //         model: MappingTransactionModel,
            //         raw: true,
            //         as: 'mapping_transaction'
            //     },
            //     {
            //         model: MappingTransactionModel,
            //         raw: true,
            //         as: 'transaction'
            //     },
            //     {
            //         model: CompanyUser,
            //         raw: true,
            //         as: 'replaced_by_user'
            //     }

            // ],
            order: [['createdAt', 'ASC']],
            raw: true,
            nest: true
            //limit: 1000
          })
        }

        for (let item of specificCodes) {
          if (limitReached) {
            break;
          }
          let mrpData = await qrcodeController.getCalculatedMRP(element.product_batch, element.product_batch.mrp);
          let varName = element.packaging_level.toLowerCase() + 'MRP';
          let UIDMrp = mrpData[varName];
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
          let mrpData = await qrcodeController.getCalculatedMRP(element.product_batch, element.product_batch.mrp);
          let varName = element.packaging_level.toLowerCase() + 'MRP';
          let UIDMrp = mrpData[varName];
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

        for (let item of childCodes) {
          if (limitReached) {
            break;
          }
          let mrpData = await qrcodeController.getCalculatedMRP(element.product_batch, element.product_batch.mrp);
          let varName = element.packaging_level.toLowerCase() + 'MRP';
          let UIDMrp = mrpData[varName];
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
            "MRP": UIDMrp ? UIDMrp : '',
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

        if (SpecificModel) {
          SpecificModel.hasOne(MappingTransactionModel, {
            foreignKey: 'id',
            sourceKey: 'mapp_transaction_id',
            as: 'transaction'
          })

          SpecificModel.hasOne(MappingTransactionModel, {
            foreignKey: 'id',
            sourceKey: 'transaction_id',
            as: 'mapping_transaction'
          })

          SpecificModel.hasOne(CompanyUser, {
            foreignKey: 'id',
            sourceKey: 'replaced_by',
            as: 'replaced_by_user'
          })

          SpecificModel.hasOne(ProductionOrderModel, {
            foreignKey: 'id',
            sourceKey: 'po_id'
          })
        }
        if (GeneralModel) {
          GeneralModel.hasOne(MappingTransactionModel, {
            foreignKey: 'id',
            sourceKey: 'mapp_transaction_id',
            as: 'transaction'
          })

          GeneralModel.hasOne(MappingTransactionModel, {
            foreignKey: 'id',
            sourceKey: 'transaction_id',
            as: 'mapping_transaction'
          })

          GeneralModel.hasOne(CompanyUser, {
            foreignKey: 'id',
            sourceKey: 'replaced_by',
            as: 'replaced_by_user'
          })

          GeneralModel.hasOne(ProductionOrderModel, {
            foreignKey: 'id',
            sourceKey: 'po_id'
          })
        }
        if (ChildModel) {
          ChildModel.hasOne(MappingTransactionModel, {
            foreignKey: 'id',
            sourceKey: 'mapp_transaction_id',
            as: 'transaction'
          })

          ChildModel.hasOne(MappingTransactionModel, {
            foreignKey: 'id',
            sourceKey: 'transaction_id',
            as: 'mapping_transaction'
          })

          ChildModel.hasOne(CompanyUser, {
            foreignKey: 'id',
            sourceKey: 'replaced_by',
            as: 'replaced_by_user'
          })

          ChildModel.hasOne(ProductionOrderModel, {
            foreignKey: 'id',
            sourceKey: 'po_id'
          })
        }

        let specificCodes = await SpecificModel.findAll({
          where: {
            transaction_id: element.id,
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
        let generalCodes = [];
        if (GeneralModel) {
          generalCodes = await GeneralModel.findAll({
            where: {
              transaction_id: element.id,
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
        }
        let childCodes = [];
        if (ChildModel) {
          childCodes = await ChildModel.findAll({
            where: {
              mapp_transaction_id: element.id,
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
        }

        for (let item of specificCodes) {
          if (limitReached) {
            break;
          }
          let details = await getParentChildDetails(item, res);
          if (details.success == 1) {
            let obj = {
              "Transaction Type": !isOther ? "Mapping" : 'Non-QR-To-QR',
              "Transaction Date": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
              "Location": element.location.unique_name,
              "Item Code": element.product.sku,
              "PO No.": element.production_order.po_number,
              "Batch No.": element.product_batch.batch_no,
              "MRP": details.data.UIDMrp ? details.data.UIDMrp : '',
              "Transacation Level": element.packaging_level,
              "unique_code": item.unique_code,
              "Parent": details.data.parent.toString(),
              "Child": details.data.child.toString(),
              "Code Level": element.packaging_level,
              "Code Type": "Specific",
            }
            if (isOther) {
              obj['Activated At'] = moment(new Date(item.completed_at)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase();
            }
            else {
              obj['Completed At'] = moment(new Date(item.completed_at)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase();

            }

            data.push(obj);
          }
          if (data.length == exportLimit) {
            console.log("---------------------------Limit reached--------Specific");
            limitReached = true
          }
        }

        for (let item of generalCodes) {
          if (limitReached) {
            break;
          }
          let details = await getParentChildDetails(item, res);
          if (details.success == 1) {
            let obj = {
              "Transaction Type": 'Non-QR-To-QR',
              "Transaction Date": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
              "Location": element.location.unique_name,
              "Item Code": element.product.sku,
              "PO No.": element.production_order.po_number,
              "Batch No.": element.product_batch.batch_no,
              "MRP": details.data.UIDMrp ? details.data.UIDMrp : '',
              "Transacation Level": element.packaging_level,
              "unique_code": item.unique_code,
              "Parent": details.data.parent.toString(),
              "Child": details.data.child.toString(),
              "Code Level": element.packaging_level,
              "Activated At": moment(new Date(item.completed_at)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
              "Code Type": "General",
            }
            data.push(obj)
          }
          if (data.length == exportLimit) {
            console.log("---------------------------Limit reached--------General");
            limitReached = true
          }
        }

        for (let item of childCodes) {
          if (limitReached) {
            break;
          }
          let details = await getParentChildDetails(item, res);
          if (details.success == 1) {
            let obj = {
              "Transaction Type": !isOther ? "Mapping" : 'Non-QR-To-QR',
              "Transaction Date": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
              "Location": element.location.unique_name,
              "Item Code": element.product.sku,
              "PO No.": element.production_order.po_number,
              "Batch No.": element.product_batch.batch_no,
              "MRP": details.data.UIDMrp ? details.data.UIDMrp : '',
              "Transacation Level": element.packaging_level,
              "unique_code": item.unique_code,
              "Parent": details.data.parent.toString(),
              "Child": details.data.child.toString(),
              "Code Level": element.inner_level,
              "Mapped At": moment(new Date(item.mapped_at)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
              "Code Type": "Specific-Child",
            }
            data.push(obj)
          }
          if (data.length == exportLimit) {
            console.log("---------------------------Limit reached--------child");
            limitReached = true
          }
        }
      }
    }

    // console.log("Data::", data);

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

    let whereClause = {
      location_id: req.body.locationId,
      createdAt: {
        [Op.between]: [startDate, endDate]
      },
    }

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
          "Asset ID": '',
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
            let details = await getParentChildDetails(item, res);
            if (details.success == 1) {
              let obj = {
                "Transaction Type": "Replacement",
                "Transaction Date": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
                "Location": element.location.unique_name,
                "Item Code": element.product.sku,
                "Batch No.": element.product_batch.batch_no,
                "MRP": details.data.UIDMrp ? details.data.UIDMrp : '',
                "Packaging Level": element.packaging_level,
                "code": element.code,
                "Parent": details.data.parent.toString(),
                "Child": details.data.child.toString(),
                "code Type": element.code_type,
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
                      //if (item.packaging_level == 'O') {
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

                      //}
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
            //if (item.packaging_level == 'O') {
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
    let exportType = req.body.exportType;
    let packagingLevels = ['P', 'S', 'T', 'O'];
    if (req.body.packagingLevel) {
      packagingLevels = [req.body.packagingLevel]
    }
    let data = [];
    let limitReached = false;
    if (exportType == 1) { //UID
      let productInfo = await ProductModel.findOne({
        where: {
          id: req.body.productId,
          [Op.or]: [
            {
              is_general: false
            },
            {
              is_general: true
            }
          ]
        },
        raw: true
      })

      if (!productInfo) {
        return res.status(200).send({ success: 0, message: "Item Not Found" })
      }

      // let generalProduct = await ProductModel.findOne({
      //     where: {
      //         id: req.body.productId,
      //         is_general: true
      //     },
      //     raw: true
      // })

      // if (!generalProduct) {
      //     return res.status(200).send({ success: 0, message: "General Item Not Found" })
      // }

      let batchInfo = await ProductBatchModel.findOne({
        where: {
          id: req.body.batchId
        },
        raw: true
      })
      if (!batchInfo) {
        return res.status(200).send({ success: 0, message: "Batch Not Found" })
      }

      let location = await LocationModel.findOne({
        where: {
          id: req.body.locationId
        },
        raw: true
      })
      if (!location) {
        return res.status(200).send({ success: 0, message: "Location Not Found" })
      }

      let whereClause = {
        [Op.or]: [
          { is_mapped: true },
          { is_active: true },
          { is_complete: true },
        ]
      };
      whereClause.batch_id = req.body.batchId
      if (req.body.productId) {
        whereClause.product_id = req.body.productId
      }
      if (packagingLevels.length == 1) {
        whereClause.packaging_level = packagingLevels[0]
      }

      for (let level of packagingLevels) {
        if (limitReached) {
          break;
        }
        let CustomModel = await getDynamicModel(level, productInfo.u_id)
        console.log('1:::::', whereClause);
        let stock = await CustomModel.findAll({
          where: whereClause,
          include: [
            {
              model: StorageBins,
              where: {
                location_id: req.body.locationId
              },
              attributes: ["name", "id", "location_id"],
              raw: true,
            },
          ],
          order: [['createdAt', 'ASC']],
          raw: true
        })
        console.log("Stock Found::", productInfo.u_id, stock.length);

        // let CustomModel2 = await getDynamicModel(level, generalProduct.u_id)
        // console.log('2:::::',whereClause);
        // let generalStock = await CustomModel2.findAll({
        //     where: whereClause,
        //     include: [
        //         {
        //             model: StorageBins,
        //             where: {
        //                 location_id: req.body.locationId
        //             },
        //             attributes: ["name", "id", "location_id"],
        //             raw: true,
        //         },
        //     ],
        //     order: [['createdAt', 'ASC']],
        //     raw: true
        // })
        // console.log("General Stock::", generalProduct.u_id, generalStock.length);

        //let allStock = [...stock, ...generalStock]
        console.log("All Stock::", stock.length);
        if (stock.length > 0) {
          for (let element of stock) {
            if (limitReached) {
              break;
            }
            let obj = {
              "Location ID": location.unique_name,
              "Item Code": productInfo.sku,
              "Batch No.": batchInfo.batch_no,
              "UID": element.unique_code,
              //"Mfg. Date": moment(new Date(batchInfo.mfg_date)).format('DD/MMM/YYYY').toUpperCase(),
              //"Exp. Date": moment(new Date(batchInfo.exp_date)).format('DD/MMM/YYYY').toUpperCase(),
              "Code Level": level,
              "Code Type": element.is_open ? 'Open' : element.is_general ? 'General' : 'Specific',
              "Completed At": moment(new Date(element.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
            }
            data.push(obj);
            if (data.length == exportLimit) {
              console.log("---------------------------Limit reached--------child");
              limitReached = true
            }
          }
        }
      }
    } else if (exportType == 2) { //Quantity
      let whereClause = {
        location_id: req.body.locationId,
        product_id: req.body.productId,
        batch_id: req.body.batchId
      }
      if (packagingLevels.length == 1) {
        whereClause.packaging_level = packagingLevels[0]
      }
      let stockDetails = await StockSummary.findAll({
        where: whereClause,
        include: [
          {
            model: StorageBins,
            raw: true,
            as: 'bin',
            attributes: ["name", "id"]
          },
          {
            model: ProductModel,
            attributes: ["name", "id", "sku"],
            raw: true,
          },
          {
            model: productBatches,
            attributes: ["id", "batch_no"],
            raw: true,
          },
          {
            model: LocationModel,
            attributes: ["id", "unique_name", "name"],
            raw: true,
          }
        ],
        order: [['createdAt', 'ASC']],
        raw: true,
        nest: true
      })

      for (let item of stockDetails) {
        if (limitReached) {
          break;
        }
        let obj = {
          "Location ID": item.location.unique_name,
          "Item Code": item.product.sku,
          "Batch No.": item.product_batch.batch_no,
          "Quantity": item.qty,
          "Packaging Level": item.packaging_level,
          //"Code Type": element.is_open ? 'Open' : element.is_general ? 'General' : 'Specific',
          "Completed At": moment(new Date(item.createdAt)).tz("Asia/Kolkata").format('DD/MMM/YYYY HH:mm:ss').toUpperCase(),
        }
        data.push(obj);
        if (data.length == exportLimit) {
          console.log("---------------------------Limit reached--------child");
          limitReached = true
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
async function getParentChildDetails(codeFound, res) {
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
    //console.log('codeFound::::::::::::;;', codeFound);
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
    let mappingType = '-';
    let replacedFrom = '-'
    let replacedBy = '-'
    // if (codeFound.is_replaced) {
    //     mappingType = 'Replaced';
    //     replacedBy = codeFound.replaced_with;
    //     // replacedBy = codeFound.replaced_by_user.name;

    // } else if (codeFound.transaction_id || codeFound.mapp_transaction_id) {
    //     if (codeFound.transaction.is_other || codeFound.mapping_transaction.is_other) {
    //         mappingType = 'NonQR-QR';
    //     }
    //     else {
    //         mappingType = 'Mapped';
    //     }
    // } else if (codeFound.is_mapped || codeFound.is_complete) {
    //     mappingType = 'Mapped';
    // }
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
            return res.status(200).send({ success: 0, message: `Child Model (${!ChildModel ? 'Specific' : 'General'}) Not Found` })
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

module.exports = stock_report;