//Libraries
const v = require("node-input-validator");
const uuid = require("uuid");

var counts = {
  primaryCount: 0,
  secondaryCount: 0,
  tertiaryCount: 0,
  outerCount: 0
};

// Middlewares
const parseValidate = require('../../middleware/parseValidate')
const logger = require("../../helpers/logger");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const moment = require('moment');

// Models
const DynamicModels = require('../../models/dynamic_models')
const ProductModel = require("../../models").products;
const ProductionOrderModel = require("../../models").production_orders;
const ProductBatchModel = require('../../models').product_batches;
const scanningTransactionModel = require('../../models/').scanning_transactions;
const LocationModel = require('../../models').locations;
const TransactionScannedModel = require('../../models').transaction_scanned_info
const StorageBinModel = require('../../models').storage_bins
const DynamicUIDModel = require('../../models').dynamic_uids;
const StockSummary = require('../../models').stock_summary;
const ReplacementHistory = require('../../models').replacement_history;
const DynamicLevelCodesModel = require('../../models').dynamic_level_codes;
const CompanyUser = require('../../models').company_users;
// const XCompanyCodes = require('./../models/').x_company_codes;
const models = require("../_models");

//Controllers
const commonController = require('../common');
const qrcodeController = require('../../controllers/qr-codes-controller');
const common = require('../common');


// These type of imports creates circular dependency please be careful while using or remove

// Global Last code to avoid duplicacy
let lastCode;
let lastOtherCode;
let lastScannedCode;
let TRCompleteInProgress = false;
let OtherTRCompleteInProgress = false;
let scanInProcess = [];
/**
* @owner Yash Modi
* @description Bulk Mapping Controller
*/

module.exports = {
  addTransaction: async (req, res) => {
    try {
      let validator = new v(req.body, {
        productId: "required",
        batchId: "required",
        // packagingLevel: "required|in:S,T,O",
        // parentsToScan: "required|integer"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let productInfo = await ProductModel.findOne({
        where: {
          id: req.body.productId
        },
        raw: true
      })

      if (!productInfo) {
        return res.status(200).send({ success: 0, message: "Item Not Found" })
      }

      console.log("Product Info Found");

      let transactionInfo = await models.scanningTransactionModel.findOne({
        where: {
          // device_id: req.deviceId,
          // product_id: req.body.productId,
          // batch_id: req.body.batchId,
          created_by: req.userId,
          status: {
            [Op.in]: [0, 1]
          },
          is_other: false
        },
        include: [{
          model: models.ProductBatchModel
        }],
        raw: true,
        nest: true
      });


      let batchInfo = await models.ProductBatchModel.findOne({
        where: {
          id: req.body.batchId,
          product_id: req.body.productId
        },
        raw: true,
        nest: true
      })
      if (!batchInfo) {
        return res.status(200).send({ success: 0, message: "Product Batch not found" })
      }
      if (batchInfo.packaging_type == 1) {
        productInfo.is_mapp_outer = true;
        batchInfo.is_mapp_outer = true;
      }
      if (batchInfo.status == 3) {
        return res.status(200).send({ success: 0, message: "Product Batch Already Completed." })
      }
      console.log("Product Batch Info Found");

      let masterInfo = batchInfo;
      var secondarysize = [null].includes(Number(masterInfo.secondary_size)) ? 0 : Number(masterInfo.secondary_size);
      var tertiarySize = [null].includes(Number(masterInfo.tertiary_size)) ? 0 : Number(masterInfo.tertiary_size);
      var outerSize = [null].includes(Number(masterInfo.outer_size)) ? 0 : Number(masterInfo.outer_size);
      var Primarytotal = 1 * (masterInfo.secondary_size > 0 ? secondarysize : 1) * (masterInfo.tertiary_size > 0 ? tertiarySize : 1) * (masterInfo.outer_size > 0 ? outerSize : 1);
      var secondaryTotal = 1 * (masterInfo.tertiary_size > 0 ? tertiarySize : 1) * (masterInfo.is_mapp_outer ? outerSize : 1);
      var tertiaryTotal = 1 * (masterInfo.outer_size > 0 ? outerSize : 1);
      var outerTotal = 1;
      let total = {
        primaryCount: Primarytotal,
        secondaryCount: secondaryTotal,
        tertiaryCount: tertiaryTotal,
        outerCount: outerTotal
      }
      let codeBylvl = {
        primary: masterInfo.secondary_size != null ? masterInfo.secondary_size : masterInfo.tertiary_size != null ? masterInfo.tertiary_size : masterInfo.outer_size != null ? masterInfo.outer_size : 0,
        secondary: masterInfo.tertiary_size != null ? masterInfo.tertiary_size : masterInfo.outer_size != null ? masterInfo.outer_size : 0,
        tertiary: masterInfo.outer_size != null ? masterInfo.outer_size : 0,
        outer: 1
      };
      let factor = {
        primary: 0,
        secondary: 0,
        tertiary: 0,
        outer: 0
      };
      if (transactionInfo) {
        let result = await verifyCodeLevel(transactionInfo);
        productInfo.level = result.newLevel;
        batchInfo.level = result.newLevel;
        batchInfo.sku = productInfo.sku;

        let factorCount = await getcodeCounts(masterInfo, transactionInfo);
        let counts = await getScanedCount(transactionInfo.id, masterInfo, batchInfo.packaging_type);
        let unmappedCodes = await models.transactionChildModel.findAll({ where: { transaction_id: transactionInfo.id }, raw: true });
        let unmappedLvlP = unmappedCodes.filter(x => x.level == 'P').map(x => x.scanned_code);
        let unmappedLvlS = unmappedCodes.filter(x => x.level == 'S').map(x => x.scanned_code);
        let unmappedLvlT = unmappedCodes.filter(x => x.level == 'T').map(x => x.scanned_code);
        let unmappedLvlO = unmappedCodes.filter(x => x.level == 'O').map(x => x.scanned_code);


        let unMppedCodes = [
          { level: 'P', codes: unmappedLvlP },
          { level: 'S', codes: unmappedLvlS },
          { level: 'T', codes: unmappedLvlT },
          { level: 'O', codes: unmappedLvlO },
        ];
        let Psize = (masterInfo.secondary_size != null ? masterInfo.secondary_size : (masterInfo.tertiary_size != null ? masterInfo.tertiary_size : (masterInfo.outer_size != null ? masterInfo.outer_size : 1)));
        let Ssize = (masterInfo.tertiary_size != null ? masterInfo.tertiary_size : (masterInfo.outer_size != null ? masterInfo.outer_size : 1));
        let Tsize = (masterInfo.outer_size != null ? masterInfo.outer_size : 1);
        factor = {
          primary: unmappedLvlP.length == Psize ? unmappedLvlP.length : (unmappedLvlP.length % Psize),
          secondary: unmappedLvlS.length == Ssize ? unmappedLvlS.length : (unmappedLvlS.length % Ssize),
          tertiary: unmappedLvlT.length == Tsize ? unmappedLvlT.length : (unmappedLvlT.length % Tsize),
          outer: unmappedLvlO.length
        };
        return res.status(200).send(
          {
            success: 1,
            message: "Transaction is already in Prodcess.",
            data: {
              transactionInfo,
              productInfo: batchInfo,
              batchInfo,
              scanned: counts,
              unMppedCodes,
              total,
              codeBylvl,
              factor,
              factorCount
            }
          })
      }

      console.log("Request validated");


      console.log("masterInfo::", masterInfo);

      let packagingSize;
      let isPackagingApplicable = false;
      let innerLevel;
      let hasLastChild = false;

      let locationInfo = await LocationModel.findOne({
        where: {
          id: req.locationId
        },
        raw: true,
        attributes: ['id', 'unique_name']
      })
      if (!locationInfo) {
        return res.status(200).send({ success: 0, message: "Location not found" })
      }

      // Finding Storage Bin 

      let storageBin = await StorageBinModel.findOne({
        where: {
          name: "OK",
          location_id: req.locationId
        },
        attributes: ['id'],
        raw: true
      })

      if (!storageBin) {
        return res.status(200).send({ success: 0, message: "Storage Bin not found" })
      }

      console.log("Location Info Found");

      // Generate Unique Transaction ID
      let trCode = "1000001";
      let lastTR = await scanningTransactionModel.findOne({
        where: {},
        attributes: ['tr_code'],
        order: [["createdAt", "DESC"]],
        raw: true
      });
      console.log("last TR", lastTR);
      if (lastTR) {
        trCode = ((parseInt(lastTR.tr_code, 36) + 1).toString(36)).toUpperCase();
      }

      let transactionId = 'R' + locationInfo.unique_name + trCode;

      let transactionExists = await scanningTransactionModel.findOne({
        where: {
          transaction_id: transactionId
        }
      })
      if (transactionExists) {
        return res.status(200).send({ success: 0, message: "Transaction already exists. please try again" })
      }

      let trId = uuid()
      let obj = {
        id: trId,
        transaction_id: transactionId,
        product_id: req.body.productId,
        // po_id: poInfo.id,
        batch_id: batchInfo.id,
        // packaging_level: req.body.packagingLevel,
        // packaging_size: masterInfo.packaging_type == 2 ? packagingSize : null,
        // parents_to_mapped: parentsToScan,
        tr_code: trCode,
        started_at: new Date(),
        created_by: req.userId,
        // created_at: commonController.GetEpoch(),
        // updated_at: commonController.GetEpoch(),
        device_id: req.deviceId,
        u_id: productInfo.u_id,
        // inner_level: innerLevel ? innerLevel : '',
        storage_bin: storageBin.id,
        has_last_child: hasLastChild,
        status: 1,
        location_id: req.locationId
      }

      console.log("----------Transaction Object::", obj);
      await scanningTransactionModel.create(obj);

      // await TransactionScannedModel.create({
      //   id: uuid(),
      //   transaction_id: trId
      // })
      obj.p_lvl = 0;
      obj.s_lvl = 0;
      obj.t_lvl = 0;
      obj.o_lvl = 0;
      obj.product_batch = batchInfo;
      let result = await verifyCodeLevel(obj);
      productInfo.level = result.newLevel;
      batchInfo.level = result.newLevel;
      batchInfo.sku = productInfo.sku;
      let factorCount = await getcodeCounts(batchInfo, null);
      if (batchInfo.status == 1) {
        await models.ProductBatchModel.update(
          {
            status: 2,
          },
          {
            where: {
              id: batchInfo.id
            },
            raw: true
          })
      }
      return res.send({
        success: 1, message: "Transaction created successfully!", data:
        {
          transactionInfo: obj,
          productInfo: batchInfo,
          batchInfo,
          scanned: {
            "primaryCount": 0,
            "secondaryCount": 0,
            "tertiaryCount": 0,
            "outerCount": 0
          },
          total,
          codeBylvl,
          factor,
          factorCount
        }
      });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.toString() });
    }
  },
  getTransactionInfo: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      let transactionInfo = await models.scanningTransactionModel.findOne({
        where: {
          // device_id: req.deviceId,
          id: req.query.id,
          created_by: req.userId,
          status: {
            [Op.in]: [0, 1]
          },
          is_other: false
        },
        include: [{
          model: models.ProductBatchModel
        }],
        raw: true,
        nest: true
      })

      if (!transactionInfo) {
        return res.status(200).send(
          {
            success: 1,
            message: "No Pending Transaction Found",
            trId: ""
          })
      }

      let batchInfo = await models.ProductBatchModel.findOne({
        where: {
          id: transactionInfo.batch_id,
          product_id: transactionInfo.product_id
        },
        raw: true,
        nest: true
      })
      if (!batchInfo) {
        return res.status(200).send({ success: 0, message: "Product Batch not found" })
      }

      if (batchInfo.status == 3) {
        return res.status(200).send({ success: 0, message: "Product Batch Already Completed." })
      }
      console.log("Product Batch Info Found");

      let productInfo = await ProductModel.findOne({
        where: {
          id: transactionInfo.product_id
        },
        raw: true
      })

      if (!productInfo) {
        return res.status(200).send({ success: 0, message: "Item Not Found" })
      }
      console.log("Product Info Found");
      let result = await verifyCodeLevel(transactionInfo);
      if (batchInfo.packaging_type == 1) {
        productInfo.is_mapp_outer = true;
        batchInfo.is_mapp_outer = true;
      }
      productInfo.level = result.newLevel;
      batchInfo.level = result.newLevel;
      batchInfo.sku = productInfo.sku;
      let masterInfo = batchInfo;
      var secondarysize = [null].includes(Number(masterInfo.secondary_size)) ? 0 : Number(masterInfo.secondary_size);
      var tertiarySize = [null].includes(Number(masterInfo.tertiary_size)) ? 0 : Number(masterInfo.tertiary_size);
      var outerSize = [null].includes(Number(masterInfo.outer_size)) ? 0 : Number(masterInfo.outer_size);
      var Primarytotal = 1 * (masterInfo.secondary_size > 0 ? secondarysize : 1) * (masterInfo.tertiary_size > 0 ? tertiarySize : 1) * (masterInfo.outer_size > 0 ? outerSize : 1);
      var secondaryTotal = 1 * (masterInfo.tertiary_size > 0 ? tertiarySize : 1) * (masterInfo.is_mapp_outer ? outerSize : 1);
      var tertiaryTotal = 1 * (masterInfo.outer_size > 0 ? outerSize : 1);
      var outerTotal = 1;
      let total = {
        primaryCount: Primarytotal,
        secondaryCount: secondaryTotal,
        tertiaryCount: tertiaryTotal,
        outerCount: outerTotal
      }

      let codeBylvl = {
        primary: masterInfo.secondary_size != null ? masterInfo.secondary_size : masterInfo.tertiary_size != null ? masterInfo.tertiary_size : masterInfo.outer_size != null ? masterInfo.outer_size : 0,
        secondary: masterInfo.tertiary_size != null ? masterInfo.tertiary_size : masterInfo.outer_size != null ? masterInfo.outer_size : 0,
        tertiary: masterInfo.outer_size != null ? masterInfo.outer_size : 0,
        outer: 1
      };
      let factor = {
        primary: 0,
        secondary: 0,
        tertiary: 0,
        outer: 0
      };
      if (transactionInfo) {

        let factorCount = await getcodeCounts(masterInfo, transactionInfo);
        let counts = await getScanedCount(transactionInfo.id, masterInfo, batchInfo.packaging_type);

        let unmappedCodes = await models.transactionChildModel.findAll({ where: { transaction_id: req.query.id, parent_code: null }, raw: true });
        let unmappedLvlP = unmappedCodes.filter(x => x.level == 'P').map(x => x.scanned_code);
        let unmappedLvlS = unmappedCodes.filter(x => x.level == 'S').map(x => x.scanned_code);
        let unmappedLvlT = unmappedCodes.filter(x => x.level == 'T').map(x => x.scanned_code);
        let unmappedLvlO = unmappedCodes.filter(x => x.level == 'O').map(x => x.scanned_code);


        let unMppedCodes = [
          { level: 'P', codes: unmappedLvlP },
          { level: 'S', codes: unmappedLvlS },
          { level: 'T', codes: unmappedLvlT },
          { level: 'O', codes: unmappedLvlO },
        ];
        let Psize = (masterInfo.secondary_size != null ? masterInfo.secondary_size : (masterInfo.tertiary_size != null ? masterInfo.tertiary_size : (masterInfo.outer_size != null ? masterInfo.outer_size : 1)));
        let Ssize = (masterInfo.tertiary_size != null ? masterInfo.tertiary_size : (masterInfo.outer_size != null ? masterInfo.outer_size : 1));
        let Tsize = (masterInfo.outer_size != null ? masterInfo.outer_size : 1);
        factor = {
          primary: unmappedLvlP.length == Psize ? unmappedLvlP.length : (unmappedLvlP.length % Psize),
          secondary: unmappedLvlS.length == Ssize ? unmappedLvlS.length : (unmappedLvlS.length % Ssize),
          tertiary: unmappedLvlT.length == Tsize ? unmappedLvlT.length : (unmappedLvlT.length % Tsize),
          outer: unmappedLvlO.length
        };
        return res.status(200).send(
          {
            success: 1,
            message: "Transaction is already in Prodcess.",
            data: {
              transactionInfo,
              productInfo: batchInfo,
              batchInfo,
              scanned: counts,
              unMppedCodes,
              total,
              codeBylvl,
              factor,
              factorCount
            }
          })
      }
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.toString() });
    }
  },
  getPendingTransaction: async (req, res) => {
    try {
      // let validator = new v(req.body, {
      //   productId: "required",
      //   poId: "required"
      // });

      // let matched = await validator.check();
      // if (!matched) {
      //   let validatorError = await parseValidate(validator.errors)
      //   return res.status(200).send({ success: 0, message: validatorError });
      // }

      if (!req.deviceId) {
        return res.status(200).send({ success: 0, message: "Devide Id required." })
      }
      let transactionInfo = await scanningTransactionModel.findOne({
        where: {
          // device_id: req.deviceId,
          created_by: req.userId,
          status: {
            [Op.in]: [0, 1]
          },
          is_other: false
        },
        attributes: ['id'],
        raw: true,
      })

      if (!transactionInfo) {
        return res.status(200).send({ success: 1, data: { trId: "" } })
      }


      return res.status(200).send({ success: 1, data: { trId: transactionInfo.id } })

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },
  scanCode: async (req, res) => {
    let TRID;
    try {
      req.body.is_retry = (req.body.is_retry == undefined ? false : req.body.is_retry);
      let validator = new v(req.body, {
        trId: "required",
        code: "required",
        packagingLevel: "required|in:S,T,O,P",
        is_retry: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      TRID = req.body.trId;
      // if last code is same as current code then waiting for 20 ms for execution
      if (lastCode == req.body.code) {
        console.log("-----------------------------------------------------------------------Waiting------------------------");
        await sleep(500)
      }
      lastCode = req.body.code;

      let transactionInfo = await models.scanningTransactionModel.findOne({
        where: {
          id: req.body.trId,
          status: {
            [Op.in]: [0, 1, 2]
          },
          // device_id: req.deviceId
          created_by: req.userId
        },
        include: [
          {
            model: models.ProductBatchModel
          }
        ],
        raw: true,
        nest: true
      })
      // console.log("---Transaction Info::", transactionInfo);

      if (!transactionInfo) {
        return res.status(200).send({ success: 0, message: "Transaction not found." })
      }
      if (transactionInfo.status == 2) {
        return res.status(200).send({ success: 0, message: "Transaction Completed...", data: { trId: transactionInfo.id } })
      }
      if (transactionInfo.mapped_count == transactionInfo.parents_to_mapped) {
        return res.status(200).send({ success: 0, message: "Scanning completed please submit" })
      }

      if (scanInProcess.filter(x => x.id == transactionInfo.id).length != 0) {
        return res.status(200).send({ success: 0, message: "Previous Transaction In Process ,Try Again" })
      }
      scanInProcess.push({ id: transactionInfo.id });

      let { packagingSize, isPackagingApplicable, innerLevel, hasLastChild, hasParent, hasParentLevel, hasparentSize } = await findLevels(transactionInfo.product_batch, req.body.packagingLevel);

      let { level, uniqueCode } = await commonController.varifyDynamicCodes(req.body.code);
      if (level == null) {
        scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
        return res.status(200).send({ success: 0, message: "Invalide Qr Code Found", data: req.body.code })
      }

      let codeType = level;
      let { newLevel, counts } = await verifyCodeLevel(transactionInfo);

      let tranDetail = transactionInfo;
      tranDetail.p_lvl = counts.primaryCount;
      tranDetail.s_lvl = counts.secondaryCount;
      tranDetail.t_lvl = counts.tertiaryCount;
      tranDetail.o_lvl = counts.outerCount;

      let nextReturn = await verifyCodeLevel(tranDetail);
      let nextLvl = nextReturn.newLevel;

      if (req.body.is_retry == 'true' || req.body.is_retry == true) {
        let childOneTransaction = await models.transactionChildModel.findOne({ where: { transaction_id: transactionInfo.id, scanned_code: uniqueCode } });
        if (childOneTransaction) {
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          return res.status(200).send({ success: 1, message: "Code scanned Successfully", UID: uniqueCode, newLevel })
        }
        let childTransaction = await models.transactionChildModel.count({ where: { transaction_id: transactionInfo.id } });
        if (childTransaction == 0) {
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          return res.status(200).send({ success: 1, message: "Transaction Completed", UID: uniqueCode, newLevel });
        }
        if ((transactionInfo.p_lvl == 0 && transactionInfo.s_lvl == 0 && transactionInfo.t_lvl == 0 && transactionInfo.o_lvl == 0) || (transactionInfo.p_lvl == 0 && transactionInfo.s_lvl == 0 && transactionInfo.t_lvl == 0 && transactionInfo.o_lvl == 1)) {
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          return res.status(200).send({ success: 1, message: "Transaction Completed", UID: uniqueCode, newLevel });
        }
      }

      if (newLevel == null) {
        scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
        return res.status(200).send({ success: 0, message: "Invalid Product Details Found" })
      }
      if (codeType != newLevel) {
        scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
        return res.status(200).send({ success: 0, message: `Please, Scan ${newLevel} Level Codes` });
      }

      if (['P', 'S', 'T'].includes(innerLevel)) { // Packagin type multi
        let parentLevel = req.body.packagingLevel;
        let childLevel = innerLevel;

        // console.log("----Code Type::", codeType);
        // let counts = await getScanedCount(transactionInfo.id, transactionInfo.product_batch);

        let scannedCodes = await models.transactionChildModel.count({ where: { transaction_id: transactionInfo.id, level: childLevel, status: null } });
        let typeToBeScanned = (scannedCodes >= packagingSize) ? 'Parent' : 'Child'
        let levelTobeScanned = typeToBeScanned == 'Parent' ? parentLevel : childLevel

        if (levelTobeScanned != codeType) {
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          return res.status(200).send({ success: 0, message: `Scan ${typeToBeScanned} Code` })
        }


        let key = typeToBeScanned == 'Parent' ? parentLevel : childLevel;
        let nextLevel = await parentLvl(key, transactionInfo.product_batch);

        let CustomModel = await getDynamicModel(key, transactionInfo.u_id);

        if (!CustomModel) {
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          return res.status(200).send({ success: 0, message: 'Dynamic Model Not found' })
        }

        let codeFound = await CustomModel.findOne({
          where: {
            [Op.or]: [
              { qr_code: req.body.code },
              { unique_code: uniqueCode }
            ],
          },
          raw: true
        })

        if (!codeFound) {
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          return res.status(200).send({ success: 0, message: `${typeToBeScanned} code not found` })
        }

        // Check if same code is scanned in another transaction or not'
        if (transactionInfo.batch_id != codeFound.batch_id) {
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          return res.status(200).send({ success: 0, message: `${typeToBeScanned} Invalid Code Found` })
        }
        if (codeFound.is_scanned) {
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          return res.status(200).send({ success: 0, message: `${typeToBeScanned} code is already scanned` })
        }
        if (codeFound.is_dropped) {
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          return res.status(200).send({ success: 0, message: `dropped codes are not allowed to scan` })
        }

        if (!codeFound.is_open) {   // Specific code
          // Check batch is matching or not if it is specific code
          if (codeFound.batch_id != transactionInfo.batch_id) {
            scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
            return res.status(200).send({ success: 0, message: "Invalid Batch" })
          }
          // check if it is of same location or not If it is not a open code
          if (codeFound.storage_bin_id != transactionInfo.storage_bin) {
            scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
            return res.status(200).send({ success: 0, message: "Location/Bin not matched" })
          }
        }

        // Block to check mapping status : Parent should not be mapped previously and child should be mapped
        if (typeToBeScanned == 'Child') {
          // if (!codeFound.is_complete && innerLevel != 'P') {  // Ignoring is_complete for Primary codes
          // scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id) , 1);
          //   return res.status(200).send({ success: 0, message: "Child Code is incomplete" })
          // }
          if (codeFound.is_mapped) {
            scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
            return res.status(200).send({ success: 0, message: "Child is already mapped" })
          }

          // Add in scanned codes 
          let childObj = {
            id: uuid.v4(),
            transaction_id: transactionInfo.id,
            level: innerLevel,
            scanned_code: codeFound.unique_code,
            scanned_code_id: codeFound.id,
            parent_level: nextLevel,
            parent_code: null,
            parent_code_id: null,
            has_last_child: hasLastChild,
            has_parent: hasParent,
            status: null
          };

          await models.transactionChildModel.upsert(childObj,
            { where: { scanned_code: codeFound.unique_code } });

          // update is_scanned flag
          await CustomModel.update(
            {
              is_scanned: true,
              // is_complete: true
            }, {
            where: {
              id: codeFound.id
            }
          });

          let codeLevelUpdate = {
            p_lvl: counts.primaryCount,
            s_lvl: counts.secondaryCount,
            t_lvl: counts.tertiaryCount,
            o_lvl: counts.outerCount
          };

          await models.scanningTransactionModel.update(codeLevelUpdate, {
            where: { id: transactionInfo.id }
          });
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          console.log(codeLevelUpdate, ">>>total");
          console.log(scanInProcess, "Done Processs")
          return res.status(200).send({ success: 1, message: "Code scanned Successfully", UID: uniqueCode, nextLvl })
        }
        else if (typeToBeScanned == 'Parent') {

          if (codeFound.is_complete) {
            scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
            return res.status(200).send({ success: 0, message: "Parent Code already completed" })
          }
          if (codeFound.is_mapped) {
            scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
            return res.status(200).send({ success: 0, message: "Child is already mapped" })
          }
          if (codeFound.is_scanned) {
            scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
            return res.status(200).send({ success: 0, message: "Code is already scanned" })
          }
          let ChildModel = await getDynamicModel(childLevel, transactionInfo.u_id);

          if (!ChildModel) {
            scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
            return res.status(200).send({ success: 0, message: 'Dynamic child model not found' })
          }

          let scannedData = await models.transactionChildModel.findAll({
            where: {
              transaction_id: transactionInfo.id,
              level: childLevel,
              status: null
            },
            raw: true
          });

          if (scannedData.length <= 0) {
            scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
            return res.status(200).send({ success: 0, message: "No scanned codes available to mapped" })
          }

          let scannedCodes = scannedData.map(x => x.scanned_code);

          await ChildModel.update({
            is_scanned: true,
            // is_mapped: true,
            // mapped_to_parent: codeFound.id,
            // parent_level: parentLevel,
            // mapped_at: new Date(),
            // mapped_by: req.userId,
            // // mapping_po_id: transactionInfo.po_id, // If code is mapped in another PO then updating PO ID,

            // batch_id: transactionInfo.batch_id,  // if open_code then updating batch Id,
            // storage_bin_id: transactionInfo.storage_bin,  // if open_code then updating Storage Bin Id,
            // mapp_transaction_id: transactionInfo.id  // Mapping Transaction ID
          }, {
            where: {
              unique_code: {
                [Op.in]: scannedCodes
              }
            }
          })

          // Marking parent as complete
          await CustomModel.update({
            // is_complete: true,
            is_scanned: true,
            // completed_at: new Date(),
            // completed_by: req.userId,
            // is_active: true,  // Active true for sending it to ERP
            // transaction_id: transactionInfo.id,   // Completion Transaction Id,
            // storage_bin_id: transactionInfo.storage_bin, // if open_code then updating Storage Bin Id,
            // batch_id: transactionInfo.batch_id, //if open_code then updating batch Id,
          }, {
            where: {
              id: codeFound.id
            }
          })

          // // Clearing Scanned codes
          // await TransactionScannedModel.update({
          //   scanned_codes: []
          // }, {
          //   where: {
          //     transaction_id: transactionInfo.id
          //   }
          // })

          // Update mapped count in transaction
          await models.transactionChildModel.update({
            status: 1, //In-progress
            parent_code: codeFound.unique_code,
            parent_code_id: codeFound.id
          }, {
            where: {
              transaction_id: transactionInfo.id,
              status: null,
              scanned_code: {
                [Op.in]: scannedCodes
              }
            }
          });
          // Add in scanned codes 
          let childObj = {
            id: uuid.v4(),
            transaction_id: transactionInfo.id,
            level: req.body.packagingLevel,
            scanned_code: codeFound.unique_code,
            scanned_code_id: codeFound.id,
            parent_level: nextLevel,
            parent_code: null,
            parent_code_id: null,
            has_last_child: hasLastChild,
            has_parent: hasParent,
            status: null,
          };
          await models.transactionChildModel.upsert(childObj,
            { where: { scanned_code: codeFound.unique_code } });

          let codeLevelUpdate = {
            p_lvl: counts.primaryCount,
            s_lvl: counts.secondaryCount,
            t_lvl: counts.tertiaryCount,
            o_lvl: counts.outerCount
          };

          await models.scanningTransactionModel.update(codeLevelUpdate, {
            where: { id: transactionInfo.id }
          });

          let lastcode = await getLastParent(transactionInfo.product_batch);
          if (req.body.packagingLevel == lastcode) {
            // await models.scanningTransactionModel.update({
            //   status: 2
            // }, {
            //   where: {
            //     id: transactionInfo.id
            //   }
            // });
            // await models.transactionChildModel.update({
            //   status: 2
            // }, {
            //   where: {
            //     transaction_id: transactionInfo.id
            //   }
            // });
            let TransactionChidList = await models.transactionChildModel.findAll({ where: { transaction_id: transactionInfo.id }, order: [['createdAt', 'ASC']] });
            if (TransactionChidList.length > 0) {
              for (let index = 0; index < TransactionChidList.length; index++) {
                const element = TransactionChidList[index];
                let ChildScheme = await getDynamicModel(element.level, transactionInfo.u_id);
                let ParentScheme = await getDynamicModel(element.parent_level, transactionInfo.u_id);

                await ChildScheme.update({
                  is_scanned: false,
                  is_mapped: true,
                  mapped_to_parent: element.parent_code_id,
                  parent_level: element.parent_level,
                  mapped_at: new Date(),
                  mapped_by: req.userId,
                  // mapping_po_id: transactionInfo.po_id, // If code is mapped in another PO then updating PO ID,

                  batch_id: transactionInfo.batch_id,  // if open_code then updating batch Id,
                  storage_bin_id: transactionInfo.storage_bin,  // if open_code then updating Storage Bin Id,
                  mapp_transaction_id: transactionInfo.id,  // Mapping Transaction ID
                  to_print: true

                }, {
                  where: {
                    unique_code: element.scanned_code
                  }
                })

                //scan parent
                if (element.parent_level != null) {
                  await ParentScheme.update({
                    is_complete: true,
                    is_scanned: false,
                    is_mapped: false,
                    completed_at: new Date(),
                    completed_by: req.userId,
                    is_active: true,  // Active true for sending it to ERP
                    transaction_id: transactionInfo.id,   // Completion Transaction Id,
                    storage_bin_id: transactionInfo.storage_bin, // if open_code then updating Storage Bin Id,
                    batch_id: transactionInfo.batch_id, //if open_code then updating batch Id,

                  }, {
                    where: {
                      unique_code: element.parent_code
                    }
                  })
                }
              }
              await CustomModel.update({
                is_scanned: false,
                is_complete: true,
                is_mapped: false,
                mapped_at: new Date(),
                mapped_by: req.userId,
                // mapping_po_id: transactionInfo.po_id, // If code is mapped in another PO then updating PO ID,

                batch_id: transactionInfo.batch_id,  // if open_code then updating batch Id,
                storage_bin_id: transactionInfo.storage_bin,  // if open_code then updating Storage Bin Id,
                mapp_transaction_id: transactionInfo.id,  // Mapping Transaction ID
                to_print: true,
                is_printed: true
              }, {
                where: {
                  id: codeFound.id
                }
              })
            }
            await models.transactionChildModel.destroy({ where: { transaction_id: transactionInfo.id } });
            await models.scanningTransactionModel.update({
              p_lvl: 0,
              s_lvl: 0,
              t_lvl: 0,
              o_lvl: 0,
            }, {
              where: { id: transactionInfo.id }
            });
            await addOrUpdateStockSummary(req.locationId, transactionInfo.storage_bin, transactionInfo.product_id, transactionInfo.batch_id, parentLevel, 1)
            await models.ProductBatchModel.update({
              mapped_outers: Sequelize.literal("mapped_outers + 1")
            }, {
              where: {
                id: transactionInfo.batch_id
              }
            })

            scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
            return res.status(200).send({ success: 1, message: "Transaction Completed", UID: uniqueCode, nextLvl })
          }
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          return res.status(200).send({ success: 1, message: "Code scanned Successfully", UID: uniqueCode, nextLvl })
        }

        scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
        return res.status(200).send({ success: 0, message: "Please, Scan Code Again" })
      }
      else {   // Single Code Scanning
        let key = 'O'; // Only Outer will be allowed in Single
        let CustomModel = await getDynamicModel(key, transactionInfo.u_id);
        let codeFound = await CustomModel.findOne({
          where: {
            [Op.or]: [
              { qr_code: req.body.code },
              { unique_code: uniqueCode }
            ],
          },
          raw: true
        })

        if (!codeFound) {
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          return res.status(200).send({ success: 0, message: "Code Not Found" })
        }

        if (codeFound.is_complete) {
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          return res.status(200).send({ success: 0, message: "Code is already mapped" })
        }
        if (codeFound.is_scanned) {
          scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
          return res.status(200).send({ success: 0, message: "Code is already scanned" })
        }
        // Check batch is matching or not if it is specific code
        if (!codeFound.is_open) {
          if (codeFound.batch_id != transactionInfo.batch_id) {
            scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
            return res.status(200).send({ success: 0, message: "Invalid Batch" })
          }
          if (codeFound.storage_bin_id != transactionInfo.storage_bin) {
            scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
            return res.status(200).send({ success: 0, message: "Location/Bin not matched" })
          }
        }

        await CustomModel.update({
          is_scanned: true,
          is_complete: true,
          is_active: true,
          batch_id: transactionInfo.batch_id, // if it is open code then assigning batch Id,
          completed_at: new Date(),
          completed_by: req.userId,
          transaction_id: transactionInfo.id,
          to_print: true
        }, {
          where: {
            id: codeFound.id
          }
        })
        let childObj = {
          id: uuid.v4(),
          transaction_id: transactionInfo.id,
          level: req.body.packagingLevel,
          scanned_code: codeFound.unique_code,
          scanned_code_id: codeFound.id,
          parent_level: null,
          parent_code: null,
          parent_code_id: null,
          has_last_child: hasLastChild,
          has_parent: hasParent,
          status: null,
          to_print: true
        };
        await models.transactionChildModel.upsert(childObj,
          { where: { scanned_code: codeFound.unique_code } });
        // Update mapped count in transaction
        await models.scanningTransactionModel.update({
          status: 1, //In-progress
          mapped_count: transactionInfo.mapped_count + 1
        }, {
          where: {
            id: transactionInfo.id
          }
        })
        await models.ProductBatchModel.update({
          mapped_outers: Sequelize.literal("mapped_outers + 1")
        }, {
          where: {
            id: transactionInfo.batch_id
          }
        })
        scanInProcess.splice(scanInProcess.findIndex(a => a.id === transactionInfo.id), 1);
        return res.status(200).send({ success: 1, message: "Scanned successfully.", UID: codeFound.unique_code, nextLvl })

      }

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      scanInProcess.splice(scanInProcess.findIndex(a => a.id === TRID), 1);
      return res.status(500).send({ success: 0, message: "Internal Server Error" });
    }
  },
  discard: async (req, res) => {
    try {
      let validator = new v(req.body, {
        trId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      let transactionDetails = await models.scanningTransactionModel.findOne({
        where: { id: req.body.trId },
        include: [{
          model: models.productsModel,
        },
        {
          model: ProductBatchModel,
        }
        ],
        raw: true,
        nest: true
      });
      if (!transactionDetails) {
        return res.status(200).send({ success: 0, message: "Transaction info not found" })
      }
      if (transactionDetails.product_batch.packaging_type == 1) {
        return res.status(200).send({ success: 0, message: "Discard Not Applicable For Single Type Product" })
      }
      let level = {
        'lvl1': 'P',
        'lvl2': 'S',
        'lvl3': 'T',
        'lvl4': 'O'
      };
      for (let i = 1; i <= 4; i++) {
        let lvl = level[`lvl${i}`];
        let scannedData = await models.transactionChildModel.findAll({
          where: {
            transaction_id: req.body.trId,
            level: lvl
          },
          attributes: ['scanned_code'],
          raw: true,
          nest: true
        })
        let codes = scannedData.map(x => x.scanned_code);
        if (scannedData.length != 0) {
          let CustomModel = await getDynamicModel(lvl, transactionDetails.product.u_id);
          let primaryCodes;
          if (!CustomModel) {
            // return res.status(200).send({ success: 0, message: 'Dynamic Model Not found' })
          }
          console.log("----Custom Model::", CustomModel);
          // Making codes to be available for scanning
          await CustomModel.update({
            is_scanned: false,
            is_complete: false,
            is_mapped: false
          }, {
            where: {
              unique_code: {
                [Op.in]: codes
              }
            }
          })
        }
      }
      let TransactionChidList = await models.transactionChildModel.findAll({ where: { transaction_id: req.body.trId }, order: [['createdAt', 'ASC']] });
      if (TransactionChidList.length > 0) {
        for (let index = 0; index < TransactionChidList.length; index++) {
          const element = TransactionChidList[index];
          let ChildScheme = await getDynamicModel(element.level, transactionDetails.product.u_id);
          let ParentScheme = await getDynamicModel(element.parent_level, transactionDetails.product.u_id);

          await ChildScheme.update({
            is_scanned: false,
            is_mapped: false,
            is_complete: false
          }, {
            where: {
              unique_code: element.scanned_code
            }
          })

          //scan parent
          if (element.parent_level != null) {
            await ParentScheme.update({
              is_scanned: false,
              is_mapped: false,
              is_complete: false
            }, {
              where: {
                unique_code: element.parent_code
              }
            })
          }
        }
      }
      await models.transactionChildModel.destroy({ where: { transaction_id: req.body.trId } });
      await models.scanningTransactionModel.update({
        p_lvl: 0,
        s_lvl: 0,
        t_lvl: 0,
        o_lvl: 0,
      }, {
        where: { id: req.body.trId }
      });
      return res.status(200).send({ success: 1, message: "Discarded Successfully." })
    }
    catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.toString() });
    }
  },
  completeTransaction: async (req, res) => {
    try {
      // if (TRCompleteInProgress) {  // If Transaction Completion Is In Progress then waiting for 2000 ms
      //   await sleep(2000)
      // }
      // TRCompleteInProgress = true;
      let validator = new v(req.body, {
        trId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let transactionInfo = await scanningTransactionModel.findOne({
        where: {
          id: req.body.trId
        },
        include: [
          {
            model: LocationModel,
            raw: true,
            attributes: ['id', 'unique_name']
          },
          {
            model: ProductModel,
            raw: true,
            attributes: ['id', 'sku']
          },
          {
            model: ProductBatchModel,
            raw: true,
            attributes: ['id', 'batch_no']
          },
          {
            model: ProductionOrderModel,
            raw: true,
            attributes: ['id', 'po_number']
          }
        ],
        raw: true,
        nest: true
      })

      if (!transactionInfo) {
        TRCompleteInProgress = false;
        return res.status(200).send({ success: 0, message: "No Transaction Found" })
      }
      if (transactionInfo.status == 2) {
        TRCompleteInProgress = false;
        return res.status(200).send({ success: 1, message: "Transaction Already Completed" })
      }


      if ((transactionInfo.p_lvl == 0 && transactionInfo.s_lvl == 0 && transactionInfo.t_lvl == 0 && transactionInfo.o_lvl == 0) || (transactionInfo.p_lvl == 0 && transactionInfo.s_lvl == 0 && transactionInfo.t_lvl == 0 && transactionInfo.o_lvl == 1)) {
        await scanningTransactionModel.update({
          status: 2,
          end_at: new Date(),
          erp_sync_status: 1,   // 1 :Successfull, 2:Failed
          erp_sync_at: null
        }, {
          where: {
            id: req.body.trId
          }
        });
        await models.scanningTransactionModel.update({
          p_lvl: 0,
          s_lvl: 0,
          t_lvl: 0,
          o_lvl: 0,
        }, {
          where: { id: req.body.trId }
        });
        await models.transactionChildModel.destroy({ where: { transaction_id: req.body.trId } });
        TRCompleteInProgress = false;
        return res.status(200).send({ success: 1, message: "Completed Successfully." })
      }
      else {
        return res.status(200).send({ success: 0, message: "Discard Shipper First" })
      }

    }
    catch (error) {
      console.log(error);
      logger.error(req, error.message);
      TRCompleteInProgress = false;
      return res.status(500).send({ success: 0, message: error.toString() });
    }
  },
  replaceCode: async (req, res) => {
    try {
      let validator = new v(req.body, {
        code: "required",
        replaceWith: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let result1 = await commonController.varifyDynamicCodes(req.body.code);

      let result2 = await commonController.varifyDynamicCodes(req.body.replaceWith);

      let code1 = result1.uniqueCode;
      let code2 = result2.uniqueCode;

      if (code1.length != 13 || code2.length != 13) {
        console.log("-------------Must Be Of 11 Characters");
        return res.status(200).send({ success: 0, message: "Invalid Code" })
      }
      if (code1 == code2) {
        return res.status(200).send({ success: 0, message: "Both code should not be same" });
      }

      // For Code 1
      let codeDetails1 = await getUIDAndLevel(code1);
      console.log("code 1 details:", codeDetails1);
      if (!codeDetails1) {
        return res.status(200).send({ success: 0, message: "First code is invalid" })
      }

      let uniqueCode = code1;
      let codeLevel = codeDetails1.level

      let product1 = await ProductModel.findOne({
        where: {
          u_id: codeDetails1.UID
        },
        raw: true
      })
      if (!product1) {
        return res.status(200).send({ success: 0, message: "Code 1: Item Not Found" })
      }

      let isGeneral = product1.is_general    // General Code:true,Specific Code:false
      console.log("--------Is it a general code ::", isGeneral);

      // let codeLevel = (level == 1 ? 'P' : level == 2 ? 'S' : level == 3 ? 'O' : 'T');
      console.log("----Code level::", codeLevel);

      let UID1 = codeDetails1.UID;
      if (!UID1) {
        return res.status(200).send({ success: 0, message: "First Code: Invalid UID " })
      }

      let CustomModel = await getDynamicModel(codeLevel, UID1);
      console.log("---------Custom Model::", CustomModel);
      if (!CustomModel) {
        return res.status(200).send({ success: 0, message: 'Dynamic Model Not found for first code' })
      }

      let whereClause = {
        [Op.or]: [
          { qr_code: req.body.code },
          { unique_code: uniqueCode }
        ],
        is_scanned: false, // should not scanned in current transactions.
        // is_mapped: true,    // General and Specific both codes to be mapped for replacement.
      }

      let codeFound = await CustomModel.findOne({
        where: whereClause,
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
            model: ProductBatchModel,
            as: 'product_batch',
            raw: true,
          },
          {
            model: ProductBatchModel,
            as: 'assigned_batch',
            raw: true,
          }
        ],
        raw: true,
        nest: true
      })

      if (!codeFound) {
        return res.status(200).send({ success: 0, message: `First code not found` })
      }


      let masterInfo = isGeneral ? codeFound.assigned_batch : codeFound.product_batch;

      // Function to get last parent of the tree.
      let lastParent = await getLastParent(masterInfo);
      if (!lastParent) {
        return res.status(200).send({ success: 0, message: "Last parent not found" })
      }

      let scannedLastParent = false;
      if (codeLevel == lastParent) {
        scannedLastParent = true;
      }

      if (!scannedLastParent && !codeFound.is_mapped) {
        return res.status(200).send({ success: 0, message: "Code Is not mapped." })
      }

      if (scannedLastParent && !codeFound.is_complete) {  // Last Parent should be complete
        return res.status(200).send({ success: 0, message: "Parent Is Incomplete." })
      }

      // For code 2-----------------------------------------
      let codeDetails2 = await getUIDAndLevel(code2);
      if (!codeDetails2) {
        return res.status(200).send({ success: 0, message: `Second code is invalid` })
      }
      let uniqueCode2 = code2;
      let codeLevel2 = codeDetails2.level


      let product2 = await ProductModel.findOne({
        where: {
          u_id: codeDetails2.UID
        },
        raw: true
      })
      if (!product2) {
        return res.status(200).send({ success: 0, message: "Code 2: Item Not Found" })
      }

      let isGeneral2 = product2.is_general

      console.log("--------Second code is a general code ::", isGeneral2);

      // let codeLevel2 = (level2 == 1 ? 'P' : level2 == 2 ? 'S' : level2 == 3 ? 'O' : 'T');
      console.log("---- Second Code level Code level::", codeLevel2);

      let UID2 = codeDetails2.UID;
      if (!UID2) {
        return res.status(200).send({ success: 0, message: "Second Code: Invalid UID " })
      }
      let CustomModel2 = await getDynamicModel(codeLevel2, UID2);

      if (!CustomModel2) {
        return res.status(200).send({ success: 0, message: 'Dynamic Model Not found for code 2' })
      }

      let whereClause2 = {
        [Op.or]: [
          { qr_code: code2 },
          { unique_code: uniqueCode2 }
        ],
        is_scanned: false,
        is_mapped: false,
      }

      if (isGeneral2) {
        whereClause.is_active = false;    // Non QR to QR codes are not allowed in replacement
        // whereClause.is_replaced = false;  // not replaced previously
      }

      let codeFound2 = await CustomModel2.findOne({
        where: whereClause2,
        raw: true
      })
      if (!codeFound2) {
        return res.status(200).send({ success: 0, message: `Second code not found` })
      }

      //----------------------------------------------------------

      if (codeLevel != codeLevel2) {
        return res.status(200).send({ success: 0, message: "Codes are of different packaging levels." })
      }

      codeFound.batchId = codeFound.batch_id;
      codeFound2.batchId = codeFound2.batch_id;

      codeFound.productId = isGeneral ? codeFound.assigned_product_id : codeFound.product_id;
      codeFound2.productId = isGeneral2 ? codeFound2.assigned_product_id : codeFound.product_id;

      // Batch Not applicable for open and general codes
      if ((codeFound.batchId != codeFound2.batchId) && !codeFound2.is_open && !codeFound2.is_general) {
        return res.status(200).send({ success: 0, message: "Codes are of different batches." })
      }

      // Storage bin not applicable in case of open and general codes at replace with.
      if ((codeFound.storage_bin_id != codeFound2.storage_bin_id) && !codeFound2.is_open && !codeFound2.is_general) {
        return res.status(200).send({ success: 0, message: "Codes are of different locations." })
      }

      // Remove mapping of first code


      // console.log("----Code 1::", codeFound);
      // console.log("----Code 2::", codeFound2);

      let updateClause = {
        is_replaced: true,
        replaced_with: codeFound2.unique_code,
        replaced_with_type: isGeneral2 ? 'General' : codeFound2.is_open ? 'Open' : 'Specific',
        replaced_at: new Date(),
        replaced_by: req.userId,
        // mapped_to_parent: null,  // Keeping parent for back tracing
        parent_level: null,
        // storage_bin_id: null, //  Once Replaced Code will not be at same location hence 1 will be substracted from inventory
      }

      await CustomModel.update(
        updateClause,
        {
          where: {
            id: codeFound.id
          }
        })


      // Update secondcode

      let updateClause2 = {
        is_mapped: true,
        mapped_to_parent: codeFound.mapped_to_parent,
        parent_level: codeFound.parent_level,
        mapped_at: new Date(),
        mapped_by: req.userId,
        is_active: codeFound.is_active,
        is_complete: codeFound.is_complete,
        replaced_from: codeFound.unique_code,
      }

      if (codeFound2.is_open) {
        updateClause2.batch_id = codeFound.batchId;  // if open_code then updating batch Id,
        updateClause2.storage_bin_id = codeFound.storage_bin_id  // if open_code then updating Storage Bin Id,
      }

      if (codeFound2.is_general) {
        updateClause2.assigned_product_id = codeFound.productId;  // if general code then updating batch Id,
        updateClause2.batch_id = codeFound.batchId;  // if general code then updating batch Id,
        updateClause2.storage_bin_id = codeFound.storage_bin_id  // if open_code then updating Storage Bin Id,
      }


      await CustomModel2.update(
        updateClause2, {
        where: {
          id: codeFound2.id
        }
      })



      // If it was a complete parent then assign new parent Id to its childs
      if (codeFound.is_complete) {
        let innerLevel;

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
          if (!codeFound.is_general) {
            ChildModel = await getDynamicModel(innerLevel, UID1);

            let generalProduct = await ProductModel.findOne({
              where: {
                is_general: true
              },
              raw: true
            })
            if (!generalProduct) {
              return res.status(200).send({ success: 0, message: "General Product Not Found." })
            }
            console.log("--------------------General Product Found----------------");
            GeneralChildModel = await getDynamicModel(innerLevel, generalProduct.u_id);
          }
          else {   // General code
            ChildModel = await getDynamicModel(innerLevel, codeFound.assigned_product?.u_id);   // UID of asssigned product
            GeneralChildModel = await getDynamicModel(innerLevel, UID1);   // UID1 will be general  UID only
          }
          if (!ChildModel || !GeneralChildModel) {
            return res.status(200).send({ success: 0, message: `Child Model (${!ChildModel ? 'Specific' : 'General'}) Not Found` })
          }

          // Updating parents of specific children
          await ChildModel.update({
            is_replaced: false,   // Non Replaced codes only
            mapped_to_parent: codeFound2.id,    // New Parent
          }, {
            where: {
              mapped_to_parent: codeFound.id    // Previous Parent 
            }
          })

          // // Updating parents of general children
          await GeneralChildModel.update({
            is_replaced: false,   // Non Replaced codes only
            mapped_to_parent: codeFound2.id,
          }, {
            where: {
              mapped_to_parent: codeFound.id
            }
          })

        }
        else {
          console.log("----------Inner Level Not Found------------");
        }
      }
      else {
        console.log("---Incomplete Parent");
      }

      await ReplacementHistory.create({
        id: uuid(),
        product_id: codeFound.productId,
        batch_id: codeFound.batchId,
        packaging_level: codeLevel,
        code: codeFound.unique_code,
        code_type: isGeneral ? 'General' : codeFound.is_open ? 'Open' : 'Specific',
        replaced_with: codeFound2.unique_code,
        replaced_with_type: isGeneral2 ? 'General' : codeFound2.is_open ? 'Open' : 'Specific',
        replaced_at: new Date(),
        replaced_by: req.userId,
        location_id: req.locationId,
        device_id: req.deviceId
      })

      return res.status(200).send({ success: 1, message: "Code replaced Successfully" })
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.toString() });
    }
  },
  checkUID: async (req, res) => {
    try {
      let validator = new v(req.body, {
        code: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      let uniqueCode = req.body.code;
      console.log(">>>>>>>>uniqueCode.length ", uniqueCode.length);
      if (uniqueCode.length != 11 && uniqueCode.length != 10) {
        console.log("-------------Must Be Of 10/11 Characters");
        return res.status(200).send({ success: 0, message: "Invalid Code" })
      }


      let UID;
      let level;
      if (uniqueCode.length == 11) {
        let dynamicCode = uniqueCode[2] + uniqueCode[6] + uniqueCode[8];
        let dynamicUID = await DynamicUIDModel.findOne({
          where: {
            code: dynamicCode
          },
          raw: true
        })

        if (!dynamicUID) {
          console.log("-------------Dynamic UID Not Found");
          return res.status(200).send({ success: 0, message: "Invalid Code" })
        }
        let dynamicLevel = await DynamicLevelCodesModel.findOne({
          where: {
            code: uniqueCode[4],
            level: {
              [Op.ne]: null
            }
          },
          raw: true
        })

        if (!dynamicLevel) {
          console.log("-------------,Level Not Found");
          return res.status(200).send({ success: 0, message: "Invalid Code" })
        }
        UID = dynamicUID.u_id
        level = dynamicLevel.level
      }
      else {   // Length is 10 then old Code
        let xCodeDetails = await XCompanyCodes.findOne({
          where: {
            unique_code: uniqueCode
          },
          raw: true
        })

        if (!xCodeDetails) {
          console.log("-------------,Code Not Imported");
          return res.status(200).send({ success: 0, message: "Invalid Code" })
        }
        UID = xCodeDetails.u_id;
        level = xCodeDetails.level
      }


      let productInfo = await ProductModel.findOne({
        where: {
          u_id: UID
        },
        raw: true
      })

      if (!productInfo) {
        return res.status(200).send({ success: 0, message: "Product Info Not Found" })
      }


      let generalProductInfo = await ProductModel.findOne({
        where: {
          is_general: true
        },
        raw: true
      })

      if (!generalProductInfo) {
        return res.status(200).send({ success: 0, message: "General Product Not Found" })
      }

      let isGeneral = productInfo.is_general;

      let CustomModel = await getDynamicModel(level, productInfo.u_id);

      if (!CustomModel) {
        return res.status(200).send({ success: 0, message: 'Dynamic Model Not Found' })
      }


      CustomModel.hasOne(scanningTransactionModel, {
        foreignKey: 'id',
        sourceKey: 'mapp_transaction_id',
        as: 'transaction'
      })

      CustomModel.hasOne(scanningTransactionModel, {
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


      let codeFound = await CustomModel.findOne({
        where: {
          unique_code: uniqueCode
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
            model: scanningTransactionModel,
            raw: true,
            as: 'mapping_transaction'
          },
          {
            model: scanningTransactionModel,
            raw: true,
            as: 'transaction'
          },
          {
            model: CompanyUser,
            raw: true,
            as: 'replaced_by_user'
          }

        ],
        raw: true,
        nest: true
      })

      if (!codeFound) {
        return res.status(200).send({ success: 0, message: `Code not found` })
      }

      // console.log("---------Code Found::", codeFound);


      let codeLevel = level

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
      if (codeFound.is_replaced) {
        mappingType = 'Replaced';
        replacedBy = codeFound.replaced_with;
        // replacedBy = codeFound.replaced_by_user.name;

      } else if (codeFound.transaction_id || codeFound.mapp_transaction_id) {
        if (codeFound.transaction.is_other || codeFound.mapping_transaction.is_other) {
          mappingType = 'NonQR-QR';
        }
        else {
          mappingType = 'Mapped';
        }
      } else if (codeFound.is_mapped || codeFound.is_complete) {
        mappingType = 'Mapped';
      }


      let parent = [];
      let childs = []

      if (!codeFound.is_replaced) {
        if (codeFound.is_mapped) {
          let ParentModel = await getDynamicModel(codeFound.parent_level, !isGeneral ? codeFound.product.u_id : codeFound.assigned_product.u_id);
          if (!ParentModel) {
            console.log('Dynamic Parent Model Not Found');
            // return res.status(200).send({ success: 0, message: 'Dynamic Parent Model Not Found' })
          }
          else {
            let parentCode = await ParentModel.findOne({
              where: {
                id: codeFound.mapped_to_parent
              },
              raw: true
            })
            if (!parentCode) {
              return res.status(200).send({ success: 0, message: 'Parent Code Not Found' })
            }
            parent.push(parentCode.unique_code)
          }

        }

        if (codeFound.is_complete) {
          let innerLevel;
          // let currentProductInfo = !isGeneral ? codeFound.product : codeFound.assigned_product;
          let masterInfo = !isGeneral ? codeFound.product_batch : codeFound.assigned_batch;
          // console.log(">>>>>>>>>>>>>>>>masterInfo", masterInfo);
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
              raw: true
            })

            // // Updating parents of general children
            let generalChildCodes = await GeneralChildModel.findAll({
              where: {
                is_replaced: false,
                mapped_to_parent: codeFound.id    // Previous Parent 
              },
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


      let mfgDate = !isGeneral ? codeFound.product_batch.mfg_date : codeFound.assigned_batch.mfg_date
      if (mfgDate) {
        mfgDate = moment(new Date(mfgDate)).format('DD/MMM/YYYY').toUpperCase();
      }

      let expDate = !isGeneral ? codeFound.product_batch.exp_date : codeFound.assigned_batch.exp_date
      if (expDate) {
        expDate = moment(new Date(expDate)).format('DD/MMM/YYYY').toUpperCase();
      }

      let data = [
        `Code Type : ${isGeneral ? 'General' : codeFound.is_open ? 'Open' : 'Specific'}`,
        `PO Details : ${!isGeneral && !codeFound.is_open ? codeFound.production_order.po_number : ''}`,
        `Item Code : ${!isGeneral ? codeFound.product.sku : codeFound.assigned_product.sku}`,
        `Item Name : ${!isGeneral ? codeFound.product.name : codeFound.assigned_product.name}`,
        `Batch No : ${!isGeneral ? codeFound.product_batch.batch_no : codeFound.assigned_batch.batch_no}`,
        `Mfg. Date : ${mfgDate}`,
        `Exp. Date : ${expDate}`,
        `MRP of UID : ${UIDMrp}`,
        `Date Of Generation : ${moment(new Date(codeFound.createdAt)).format('DD/MMM/YYYY').toUpperCase()}`,
        `Mapping Type : ${mappingType}`,
        `Replaced By : ${replacedBy}`,
        `Replaced From : ${codeFound.replaced_from ? codeFound.replaced_from : ''}`,
      ]

      let obj = {
        details: data,
        parent: parent,
        child: childs
      }

      return res.status(200).send({ success: 1, data: obj, message: "" })
    }
    catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: "Internal Server Error" });
    }
  },
  getHistory: async (req, res) => {
    try {
      let validator = new v(req.body, {
        productId: "required",
        batchId: "required",
        startDt: "required",
        endDt: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let ProductDetails = await models.productsModel.findOne({ where: { id: req.body.productId }, raw: true });
      if (!ProductDetails) {
        return res.status(200).send({ success: 0, message: "Product Not Found" });
      }

      let BatchDetails = await models.ProductBatchModel.findOne({ where: { id: req.body.batchId }, raw: true });
      if (!BatchDetails) {
        return res.status(200).send({ success: 0, message: "Batch Not Found" });
      }

      const startDate = new Date(req.body.startDt);
      const endDate = new Date(req.body.endDt);//'2023-12-31'

      if (startDate > endDate) {
        return res.status(200).send({ success: 0, message: "Start Date Should Not Be Greator Then End Date" });
      }
      let schema = await getDynamicModel('O', ProductDetails.u_id);

      let CodesList = await schema.findAll({
        where: {
          product_id: req.body.productId,
          batch_id: req.body.batchId,
          mapped_at: {
            [Op.between]: [startDate, endDate]
          }
        },
        raw: true
      });
      if (CodesList.length == 0) {
        return res.status(200).send({ success: 0, message: "No Codes Found" });
      }
      return res.status(200).send({ success: 1, data: CodesList, message: "get List Successfully" });

    }
    catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: "Internal Server Error" });
    }
  },
  unmapCodesTree: async (req, res) => {
    try {
      console.log("----check-1");
      console.log(req.body)
      let validator = new v(req.body, {
        uniqueCode: "required",
        email: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: "0", message: validator.errors[Object.keys(validator.errors)[0]].message });
      }
      console.log("----check-2");

      if (req.email != req.body.email) {
        return res.status(200).send({ success: 0, message: "Invalid User Email" })
      }

      // To avoid duplicate code scanning due to parallel processing.
      if (lastScannedCode == req.body.uniqueCode) {
        await sleep(400);
      }
      lastScannedCode = req.body.uniqueCode;


      let splitDetails;
      // if (req.body.uniqueCode.length != 11) {
      //   splitDetails = await getUIDAndLevel(req.body.uniqueCode);
      // } else {
      //   splitDetails = await splitUID(req.body.uniqueCode);
      // }
      splitDetails = await common.varifyDynamicCodes(req.body.uniqueCode);
      console.log("Split Details::", splitDetails);
      if (!splitDetails) {
        return res.status(200).send({ success: 0, message: "Invalid Code" })
      }
      let level = splitDetails.level;
      let tableUID = splitDetails.UID;   //  This can Be general or specific Both
      let uniqueCode = splitDetails.uniqueCode


      if (!level) {
        return res.status(200).send({ success: 0, message: "Invalid Code::Level Not Found!" })
      }

      if (!tableUID) {
        return res.status(200).send({ success: 0, message: "Invalid Code::UID Not Found!" })
      }
      if (!uniqueCode) {
        return res.status(200).send({ success: 0, message: "Invalid Code::Unique Code Not Found!" })
      }


      let CustomModel = await getDynamicModel(level, tableUID);

      if (!CustomModel) {
        return res.status(200).send({ success: 0, message: 'Invalid Code::Dynamic Model Not found' })
      }

      let codeWhereClause = {
        unique_code: uniqueCode
      }

      console.log(">>>>>>>>>>>>whereClause::", codeWhereClause);
      let codeFound = await CustomModel.findOne({
        where: codeWhereClause,
        include: [
          {
            model: StorageBinModel,
            raw: true
          },
          {
            model: ProductModel,
            as: 'assigned_product',
            raw: true,
            attributes: ['id', 'sku', 'u_id']
          },
        ],
        raw: true,
        nest: true
      })

      if (!codeFound) {
        return res.status(200).send({ success: 0, message: "Code Not Found" })
      }
      if (level == 'O') {
        if (codeFound.is_complete == false) {
          return res.status(200).send({ success: 0, message: "Code Is Not Mapped With Outer" })
        }
      } else {
        if (codeFound.is_mapped == false) {
          return res.status(200).send({ success: 0, message: "Code Is Not Mapped With Outer" })
        }
      }
      if (codeFound.storage_bin.location_id != req.locationId) {
        return res.status(200).send({ success: 0, message: "Code Is Not Available On This Location" })
      }

      let codeProductId = !codeFound.is_general ? codeFound.product_id : codeFound.assigned_product_id;
      let codeBatchId = codeFound.batch_id;
      let specificUID = !codeFound.is_general ? tableUID : codeFound.assigned_product?.u_id
      let batchInfo = await getBatchInfo(codeBatchId);
      if (!batchInfo) {
        return res.status(200).send({ success: 0, message: "Batch Not Found" })
      }
      // console.log("BatchInfo::", batchInfo);

      let productInfo = await getProductInfo(codeProductId);
      if (!productInfo) {
        return res.status(200).send({ success: 0, message: "Item Not Found" })
      }
      // let codeType = level == 1 ? 'P' : level == 2 ? 'S' : level == 3 ? 'T' : 'T';
      let OuterCode = level == 'O' ? codeFound : await getOuterParentCodes(codeFound, specificUID, batchInfo);

      if (!OuterCode) {
        return res.status(200).send({ success: 0, message: "Code Not Found" })
      }
      if (OuterCode.is_open) {
        return res.status(200).send({ success: 0, message: "Code Is Open" })
      }

      let codesList = await getAllChildCodes(OuterCode, specificUID, batchInfo);


      if (codeFound.is_uploaded == true) {
        let response = await axiosPost('/sync/deaggregation-varification', { uniqueCode: req.body.uniqueCode });
        if (response[0] == false) {
          // return res.status(200).send({ success: 0, message: response[2] });
          return res.status(200).send({ success: 0, message: response[2] });
        }
        // return res.status(200).send({ success: 0, message: "Uploaded Codes are not Allowed" })
      }

      await unmapCodes(codesList, specificUID, req.userId);
      return res.status(200).send({ success: 1, message: "De-Aggregated Successfully" })
    } catch (error) {
      console.log(error)
      logger.error(req, error.message);
      return res.status(500).send({
        success: "0",
        message: "Oops! Somthing went wrong!"
      })
    }
  },
  verifySentFile: async (req, res) => {
    try {
      console.log("----check-1");
      console.log(req.body)
      let validator = new v(req.body, {
        uniqueCode: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: "0", message: validator.errors[Object.keys(validator.errors)[0]].message });
      }
      console.log("----check-2");

      // To avoid duplicate code scanning due to parallel processing.
      if (lastScannedCode == req.body.uniqueCode) {
        await sleep(400);
      }
      lastScannedCode = req.body.uniqueCode;


      let splitDetails;
      // if (req.body.uniqueCode.length != 11) {
      //   splitDetails = await getUIDAndLevel(req.body.uniqueCode);
      // } else {
      //   splitDetails = await splitUID(req.body.uniqueCode);
      // }
      splitDetails = await common.varifyDynamicCodes(req.body.uniqueCode);
      console.log("Split Details::", splitDetails);
      if (!splitDetails) {
        return res.status(200).send({ success: 0, message: "Invalid Code" })
      }
      let level = splitDetails.level;
      let tableUID = splitDetails.UID;   //  This can Be general or specific Both
      let uniqueCode = splitDetails.uniqueCode;
      let locationId = req.locationId;

      if (!level) {
        return res.status(200).send({ success: 0, message: "Invalid Code::Level Not Found!" })
      }

      if (!tableUID) {
        return res.status(200).send({ success: 0, message: "Invalid Code::UID Not Found!" })
      }
      if (!uniqueCode) {
        return res.status(200).send({ success: 0, message: "Invalid Code::Unique Code Not Found!" })
      }


      let CustomModel = await getDynamicModel(level, tableUID);

      if (!CustomModel) {
        return res.status(200).send({ success: 0, message: 'Invalid Code::Dynamic Model Not found' })
      }

      let codeWhereClause = {
        unique_code: uniqueCode
      }

      console.log(">>>>>>>>>>>>whereClause::", codeWhereClause);
      let codeFound = await CustomModel.findOne({
        where: codeWhereClause,
        include: [
          {
            model: StorageBinModel,
            raw: true
          },
          {
            model: ProductModel,
            as: 'assigned_product',
            raw: true,
            attributes: ['id', 'sku', 'u_id']
          },
        ],
        raw: true,
        nest: true
      })

      if (!codeFound) {
        return res.status(200).send({ success: 0, message: "Code Not Found" })
      }

      if (codeFound.storage_bin.location_id != locationId) {
        return res.status(200).send({ success: 0, message: "Storage Bin Has Changed" })
      }

      if (level != 'O' ? codeFound.is_mapped == false : codeFound.is_complete == false) {
        return res.status(200).send({ success: 0, message: "Code Not Found" })
      }

      if (codeFound.is_open == true) {
        return res.status(200).send({ success: 0, message: "Code has Open" })
      }
      if (codeFound.has_parent == false) {
        return res.status(200).send({ success: 0, message: "Code has Open" })
      }
      else if (!codeFound.storage_bin || !codeFound.storage_bin?.name) {
        return res.status(200).send({ success: 0, message: 'Not At Any Location' })
      }
      else if (codeFound.storage_bin.name != 'OK') {
        return res.status(200).send({ success: 0, message: `Code Is In ${codeFound.storage_bin.name} Bin : ${codeFound.storage_bin.id}` })
      }
      else if (codeFound.is_box_opened) {
        console.log("----check-7");
        return res.status(200).send({ success: 0, message: "Code Is Opened!" });
      }

      //Check General Code Product Model
      let genProductInfo = await getGeneralProductInfo();
      if (!genProductInfo) {
        console.log("General Product Not Found");
        return res.status(200).send({ success: 0, message: "General Product Not Found" })
      }
      let generalModel = await getDynamicModel(level, genProductInfo.u_id);
      if (!generalModel) {
        console.log("General Model 1 Not Found");
        return res.status(200).send({ success: 0, message: "General Model 1 Not Found" })
      }


      let codeProductId = !codeFound.is_general ? codeFound.product_id : codeFound.assigned_product_id;
      let codeBatchId = codeFound.batch_id;
      let specificUID = !codeFound.is_general ? tableUID : codeFound.assigned_product?.u_id;
      let batchInfo = await getBatchInfo(codeBatchId);
      if (!batchInfo) {
        return res.status(200).send({ success: 0, message: "Batch Not Found" })
      }
      // console.log("BatchInfo::", batchInfo);

      let productInfo = await getProductInfo(codeProductId);
      if (!productInfo) {
        return res.status(200).send({ success: 0, message: "Item Not Found" })
      }
      // let codeType = level == 1 ? 'P' : level == 2 ? 'S' : level == 3 ? 'T' : 'T';
      let OuterCode = level == 'O' ? codeFound : await getOuterParentCodes(codeFound, specificUID, batchInfo);

      if (!OuterCode) {
        return res.status(200).send({ success: 0, message: "Code Not Found" })
      }

      let codesList = await getVerifyAllChildCodes(OuterCode, specificUID, batchInfo, locationId, genProductInfo);
      if (codesList.success == 0) {
        return res.status(200).send({ success: 0, message: codesList.message });
      }
      await unmapCodes(codesList.data, specificUID, req.userId, genProductInfo);
      return res.status(200).send({ success: 1, message: "OK" });

    } catch (error) {
      console.log(error)
      logger.error(req, error.message);
      return res.status(500).send({
        success: "0",
        message: "Oops! Somthing went wrong!"
      })
    }
  },
  verifyDropSentFile: async (req, res) => {
    try {
      console.log("----check-1");
      console.log(req.body)
      let validator = new v(req.body, {
        uniqueCode: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: "0", message: validator.errors[Object.keys(validator.errors)[0]].message });
      }
      console.log("----check-2");

      // To avoid duplicate code scanning due to parallel processing.
      if (lastScannedCode == req.body.uniqueCode) {
        await sleep(400);
      }
      lastScannedCode = req.body.uniqueCode;


      let splitDetails;
      // if (req.body.uniqueCode.length != 11) {
      //   splitDetails = await getUIDAndLevel(req.body.uniqueCode);
      // } else {
      //   splitDetails = await splitUID(req.body.uniqueCode);
      // }
      splitDetails = await common.varifyDynamicCodes(req.body.uniqueCode);
      console.log("Split Details::", splitDetails);
      if (!splitDetails) {
        return res.status(200).send({ success: 0, message: "Invalid Code" })
      }
      let level = splitDetails.level;
      let tableUID = splitDetails.UID;   //  This can Be general or specific Both
      let uniqueCode = splitDetails.uniqueCode;
      let locationId = req.locationId;

      if (!level) {
        return res.status(200).send({ success: 0, message: "Invalid Code::Level Not Found!" })
      }

      if (!tableUID) {
        return res.status(200).send({ success: 0, message: "Invalid Code::UID Not Found!" })
      }
      if (!uniqueCode) {
        return res.status(200).send({ success: 0, message: "Invalid Code::Unique Code Not Found!" })
      }


      let CustomModel = await getDynamicModel(level, tableUID);

      if (!CustomModel) {
        return res.status(200).send({ success: 0, message: 'Invalid Code::Dynamic Model Not found' })
      }

      let codeWhereClause = {
        unique_code: uniqueCode
      }

      console.log(">>>>>>>>>>>>whereClause::", codeWhereClause);
      let codeFound = await CustomModel.findOne({
        where: codeWhereClause,
        include: [
          {
            model: StorageBinModel,
            raw: true
          },
          {
            model: ProductModel,
            as: 'assigned_product',
            raw: true,
            attributes: ['id', 'sku', 'u_id']
          },
        ],
        raw: true,
        nest: true
      })

      if (!codeFound) {
        return res.status(200).send({ success: 0, message: "Code Not Found" })
      }

      if (codeFound.storage_bin.location_id != locationId) {
        return res.status(200).send({ success: 0, message: "Storage Bin Has Changed" })
      }

      // if (level != 'O' ? codeFound.is_mapped == false : codeFound.is_complete == false) {
      //   return res.status(200).send({ success: 0, message: "Code Not Found" })
      // }

      if (codeFound.is_open == true) {
        return res.status(200).send({ success: 0, message: "Code has Open" })
      }
      if (codeFound.has_parent == false) {
        return res.status(200).send({ success: 0, message: "Code has Open" })
      }
      else if (!codeFound.storage_bin || !codeFound.storage_bin?.name) {
        return res.status(200).send({ success: 0, message: 'Not At Any Location' })
      }
      else if (codeFound.storage_bin.name != 'OK') {
        return res.status(200).send({ success: 0, message: `Code Is In ${codeFound.storage_bin.name} Bin : ${codeFound.storage_bin.id}` })
      }
      else if (codeFound.is_box_opened) {
        console.log("----check-7");
        return res.status(200).send({ success: 0, message: "Code Is Opened!" });
      }

      //Check General Code Product Model
      let genProductInfo = await getGeneralProductInfo();
      if (!genProductInfo) {
        console.log("General Product Not Found");
        return res.status(200).send({ success: 0, message: "General Product Not Found" })
      }
      let generalModel = await getDynamicModel(level, genProductInfo.u_id);
      if (!generalModel) {
        console.log("General Model 1 Not Found");
        return res.status(200).send({ success: 0, message: "General Model 1 Not Found" })
      }


      let codeProductId = !codeFound.is_general ? codeFound.product_id : codeFound.assigned_product_id;
      let codeBatchId = codeFound.batch_id;
      let specificUID = !codeFound.is_general ? tableUID : codeFound.assigned_product?.u_id;
      let batchInfo = await getBatchInfo(codeBatchId);
      if (!batchInfo) {
        return res.status(200).send({ success: 0, message: "Batch Not Found" })
      }
      // console.log("BatchInfo::", batchInfo);

      let productInfo = await getProductInfo(codeProductId);
      if (!productInfo) {
        return res.status(200).send({ success: 0, message: "Item Not Found" })
      }
      // let codeType = level == 1 ? 'P' : level == 2 ? 'S' : level == 3 ? 'T' : 'T';
      let OuterCode = level == 'O' ? codeFound : await getOuterParentCodes(codeFound, specificUID, batchInfo);

      if (!OuterCode) {
        return res.status(200).send({ success: 0, message: "Code Not Found" })
      }

      let codesList = await getVerifyAllChildCodes(OuterCode, specificUID, batchInfo, locationId, genProductInfo);
      if (codesList.success == 0) {
        return res.status(200).send({ success: 0, message: codesList.message });
      }
      // await unmapCodes(codesList.data, specificUID, req.userId, genProductInfo);
      return res.status(200).send({ success: 1, message: "OK" });

    } catch (error) {
      console.log(error)
      logger.error(req, error.message);
      return res.status(500).send({
        success: "0",
        message: "Oops! Somthing went wrong!"
      })
    }
  },

  //OUTER
  addOtherTransaction: async (req, res) => {
    try {
      let validatorConfig = {
        productId: "required",
        batchNo: "required",
        packagingLevel: "required|in:P,S,T,O",
        codesToScan: "required|integer",
        isNewBatch: "required|boolean"
      }
      req.body.isNewBatch = false;// set new batch add forced restricted 
      if (req.body.isNewBatch) {
        validatorConfig.mfgDate = "required";
        validatorConfig.expDate = "required";
        validatorConfig.mrp = "required";
      }

      let validator = new v(req.body, validatorConfig);

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      console.log("Request validated");
      let productInfo = await models.productsModel.findOne({
        where: {
          id: req.body.productId,
          is_general: false
        },
        raw: true
      })

      if (!productInfo) {
        return res.status(200).send({ success: 0, message: "Item Not Found" })
      }
      let generalItem = await models.productsModel.findOne({
        where: {
          sku: 'GENERAL_ITEM',
          is_general: true
        },
        raw: true
      })

      if (!generalItem) {
        return res.status(200).send({ success: 0, message: "General Item Not Found" })
      }
      console.log("Product Info Found");

      let batchId;
      let batchFound = await models.ProductBatchModel.findOne({
        where: {
          batch_no: req.body.batchNo,
          product_id: req.body.productId
        },
        raw: true
      })
      if (!batchFound && !req.body.isNewBatch) {
        return res.status(200).send({ success: 0, message: "Batch Not found" })
      }

      if (batchFound && req.body.isNewBatch) {
        return res.status(200).send({ success: 0, message: "Batch exists please select from list" })
      }
      if (batchFound) {
        batchId = batchFound.id
      }

      let masterInfo = batchFound ? batchFound : productInfo

      let transactionInfo = await models.scanningTransactionModel.findOne({
        where: {
          // device_id: req.deviceId,
          created_by: req.userId,
          status: {
            [Op.in]: [0, 1]
          },
          is_other: true
        },
        attributes: ['id'],
        raw: true,
      })

      if (transactionInfo) {
        return res.status(200).send({ success: 0, message: "Transaction in device is already pending." })
      }

      let isPackagingApplicable = false;

      if (req.body.packagingLevel == 'P') {
        isPackagingApplicable = masterInfo.packaging_type == 1 ? false : true
      }
      else if (req.body.packagingLevel == 'S') {
        isPackagingApplicable = masterInfo.is_secondary
      }
      else if (req.body.packagingLevel == 'T') {
        isPackagingApplicable = masterInfo.is_tertiary;
      }
      else if (req.body.packagingLevel == 'O') {
        isPackagingApplicable = true;
      }

      if (!isPackagingApplicable) {
        return res.status(200).send({ success: 0, message: "Packaging Not applicable to this item." })
      }

      console.log("Packaging Validated", req.body.packagingLevel,);

      let codesToScan = Number(req.body.codesToScan);

      if (codesToScan <= 0) {
        return res.status(200).send({ success: 0, message: "Codes to scan should be greater then 0" })
      }

      let locationInfo = await models.locationModel.findOne({
        where: {
          id: req.locationId
        },
        raw: true,
        attributes: ['id', 'unique_name']
      })
      if (!locationInfo) {
        return res.status(200).send({ success: 0, message: "Location not found" })
      }

      // Finding Storage Bin 

      let storageBin = await models.storageBinsModel.findOne({
        where: {
          name: "OK",
          location_id: req.locationId
        },
        attributes: ['id'],
        raw: true
      })

      if (!storageBin) {
        return res.status(200).send({ success: 0, message: "Storage Bin not found" })
      }


      if (req.body.isNewBatch) {
        let caseMRP = await commonController.calculateCaseMRP(masterInfo, req.body.packagingLevel, req.body.mrp)
        console.log("Case MRP::", caseMRP);
        if (!caseMRP) {
          return res.status(200).send({ success: 0, message: "Case MRP Not Calculated" })
        }

        let factorInfo = await commonController.calculateMFactor(masterInfo)

        let newBatch = await models.ProductBatchModel.create({
          id: uuid(),
          batch_no: req.body.batchNo,
          product_id: req.body.productId,
          mfg_date: req.body.mfgDate + " 00:00:00",
          exp_date: req.body.expDate + " 00:00:00",
          mrp: caseMRP,
          created_by: req.userId,


          size: productInfo.size,
          shelf_life: productInfo.shelf_life,
          standard_unit: productInfo.standard_unit,
          is_secondary: productInfo.is_secondary,
          is_tertiary: productInfo.is_tertiary,
          packaging_type: productInfo.packaging_type,
          secondary_size: productInfo.secondary_size,
          tertiary_size: productInfo.tertiary_size,
          outer_size: productInfo.outer_size,
          is_mapp_primary: productInfo.is_mapp_primary,
          is_mapp_secondary: productInfo.is_mapp_secondary,
          is_mapp_tertiary: productInfo.is_mapp_tertiary,
          is_mapp_outer: productInfo.is_mapp_outer,
          is_loose_allowed: productInfo.is_loose_allowed,
          p_factor: factorInfo.pFactor,
          s_factor: factorInfo.sFactor,
          t_factor: factorInfo.tFactor,
          o_factor: factorInfo.oFactor,
        })
        newBatch = await newBatch.get({
          plain: true,
        });

        if (!newBatch) {
          return res.status(200).send({ success: 0, message: "Batch creation failed" })
        }
        batchId = newBatch.id
      }
      // Generate Unique Transaction ID
      let trCode = "1000001";
      let lastTR = await models.scanningTransactionModel.findOne({
        where: {},
        attributes: ['tr_code'],
        order: [["createdAt", "DESC"]],
        raw: true
      });
      if (lastTR) {
        trCode = ((parseInt(lastTR.tr_code, 36) + 1).toString(36)).toUpperCase();
      }
      let transactionId = 'R' + locationInfo.unique_name + trCode;
      let transactionExists = await models.scanningTransactionModel.findOne({
        where: {
          transaction_id: transactionId
        }
      })
      if (transactionExists) {
        return res.status(200).send({ success: 0, message: "Transaction already exists. please try again" })
      }

      let trId = uuid()
      let obj = {
        id: trId,
        transaction_id: transactionId,
        product_id: req.body.productId,
        batch_id: batchId,
        packaging_level: req.body.packagingLevel,
        parents_to_mapped: codesToScan,
        tr_code: trCode,
        started_at: new Date(),
        created_by: req.userId,
        created_at: commonController.GetEpoch(),
        updated_at: commonController.GetEpoch(),
        device_id: req.deviceId,
        u_id: productInfo.u_id,
        storage_bin: storageBin.id,
        is_other: true,
        gen_uid: generalItem.u_id,
        location_id: req.locationId
      }

      await models.scanningTransactionModel.create(obj);

      // await TransactionScannedModel.create({
      //   id: uuid(),
      //   transaction_id: trId
      // })
      return res.send({ success: 1, message: "Transaction created successfully!", data: { trId: trId } });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  getOtherPendingTransaction: async (req, res) => {
    try {
      if (!req.deviceId) {
        return res.status(200).send({ success: 0, message: "Devide Id required." })
      }
      let transactionInfo = await models.scanningTransactionModel.findOne({
        where: {
          // device_id: req.deviceId,
          created_by: req.userId,
          status: {
            [Op.in]: [0, 1]
          },
          is_other: true
        },
        attributes: ['id'],
        raw: true,
      })

      if (!transactionInfo) {
        return res.status(200).send({ success: 1, data: { trId: "" } })
      }
      return res.status(200).send({ success: 1, data: { trId: transactionInfo.id } })

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.message });
    }
  },
  getOtherTransactionInfo: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let transactionInfo = await models.scanningTransactionModel.findOne({
        where: {
          id: req.query.id,
          status: {
            [Op.in]: [0, 1]
          },
          is_other: true
        },
        include: [
          {
            model: models.productsModel,
            raw: true,
            attributes: ['id', 'sku']
          },
          {
            model: models.ProductBatchModel,
            attributes: ['id', 'batch_no'],
            raw: true,
          },
          // {
          //   model: TransactionScannedModel,
          //   attributes: ['id', 'scanned_codes'],
          //   raw: true,
          // }
        ],
        attributes: ['id', 'transaction_id', 'packaging_size', 'mapped_count', 'parents_to_mapped'],
        raw: true,
        nest: true
      })

      if (!transactionInfo) {
        return res.status(200).send({ success: 0, message: "Transaction Not found" })
      }


      let codes = [];
      let transactionchildCodes = await models.transactionChildModel.findAll({
        where: { transaction_id: transactionInfo.id },
        attributes: ['scanned_code'],
        raw: true
      });
      if (transactionchildCodes.length > 0) {
        codes = transactionchildCodes.map(x => x.scanned_code);
      }
      let obj = {
        trId: req.query.id,
        transactionId: transactionInfo.transaction_id,
        itemCode: transactionInfo.product.sku,
        batchNo: transactionInfo.product_batch.batch_no,
        toScan: transactionInfo.parents_to_mapped,
        codes: codes
      }

      return res.status(200).send({ success: 1, data: obj })

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.message });
    }
  },
  scanOtherCode: async (req, res) => {
    try {
      let validator = new v(req.body, {
        trId: "required",
        code: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      // if last code is same as current code then waiting for 20 ms for execution
      if (lastOtherCode == req.body.code) {
        console.log("-----------------------------------------------------------------------Waiting------------------------");
        await sleep(500)
      }
      lastOtherCode = req.body.code;

      let transactionInfo = await models.scanningTransactionModel.findOne({
        where: {
          id: req.body.trId,
          status: {
            [Op.in]: [0, 1]
          },
          device_id: req.deviceId
        },
        // include: [
        //   {
        //     model: TransactionScannedModel,
        //     raw: true
        //   }
        // ],
        raw: true,
        nest: true
      })
      console.log("---Transaction Info::", transactionInfo);

      if (!transactionInfo) {
        return res.status(200).send({ success: 0, message: "Transaction not found." })
      }

      if (transactionInfo.mapped_count == transactionInfo.parents_to_mapped) {
        return res.status(200).send({ success: 0, message: "Scanning completed please submit" })
      }

      let { level, uniqueCode, key, batch } = await commonController.varifyDynamicCodes(req.body.code);

      let isGeneral = false    // General Code:true,Specific Code:false
      if (batch == 'GENERAL_BATCH') {
        isGeneral = true
      }

      console.log("--------Is it a general code ::", isGeneral);

      let codeLevel = (level == 1 ? 'P' : level == 2 ? 'S' : level == 3 ? 'O' : 'T');
      console.log("----Code level::", codeLevel);

      let typeToBeScanned = (transactionInfo.packaging_level == 'P' ? 'Primary' : transactionInfo.packaging_level == 'S' ? 'Secondary' : transactionInfo.packaging_level == 'T' ? 'Tertiary' : transactionInfo.packaging_level == 'O' ? 'Outer' : null)
      let levelTobeScanned = transactionInfo.packaging_level;

      if (levelTobeScanned != codeLevel) {
        return res.status(200).send({ success: 0, message: `Scan ${typeToBeScanned} Code Only` })
      }

      let CustomModel;
      if (isGeneral) {  // Checking in general codes table
        CustomModel = await getDynamicModel(transactionInfo.packaging_level, transactionInfo.gen_uid);
      } else {     // Respective codes table
        CustomModel = await getDynamicModel(transactionInfo.packaging_level, transactionInfo.u_id);
      }

      if (!CustomModel) {
        return res.status(200).send({ success: 0, message: 'Dynamic Model Not found' })
      }

      let codeFound = await CustomModel.findOne({
        where: {
          [Op.or]: [
            { qr_code: req.body.code },
            { unique_code: uniqueCode }
          ],
          is_general: isGeneral,
          is_open: false  // Open codes are not allowed in Non QR to QR
        },
        raw: true
      })

      if (!codeFound) {
        return res.status(200).send({ success: 0, message: `${typeToBeScanned} code not found` })
      }


      // Check if same code is scanned in another transaction or not
      if (codeFound.is_scanned) {
        return res.status(200).send({ success: 0, message: `${typeToBeScanned} code is already scanned` })
      }

      // Check batch If it is not a general code
      if ((codeFound.batch_id != transactionInfo.batch_id) && !isGeneral) {
        return res.status(200).send({ success: 0, message: "Invalid Batch" })
      }

      // check if it is of same location or not if it is specifi code
      if ((codeFound.storage_bin_id != transactionInfo.storage_bin) && !isGeneral) {
        return res.status(200).send({ success: 0, message: "Location/Bin not matched" })
      }

      if (codeFound.is_mapped) {
        return res.status(200).send({ success: 0, message: "Code is already mapped" })
      }
      if (codeFound.is_active) {
        return res.status(200).send({ success: 0, message: "Code is already active" })
      }
      if (codeFound.is_complete) {
        return res.status(200).send({ success: 0, message: "Complete code not allowed" })
      }

      let codeScanned = {
        uniqueCode: codeFound.unique_code,
        type: isGeneral   // true:General ,false: specific
      }

      // Add in scanned codes model
      codeScanned = JSON.stringify(codeScanned);
      await models.transactionChildModel.create({
        id: uuid.v4(),
        transaction_id: transactionInfo.id,
        level: codeLevel,
        scanned_code: uniqueCode,
        type: true
      });

      // // update is_scanned flag
      await CustomModel.update(
        {
          is_scanned: true
        }, {
        where: {
          id: codeFound.id
        }
      })

      // // Update mapped count in transaction
      await models.scanningTransactionModel.update({
        status: 1, //In-progress
        mapped_count: transactionInfo.mapped_count + 1
      }, {
        where: {
          id: transactionInfo.id
        }
      })

      return res.status(200).send({ success: 1, message: "Code Scanned successfully.", UID: codeFound.unique_code, nextLvl: codeLevel })
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  discardOther: async (req, res) => {
    try {
      let validator = new v(req.body, {
        trId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      let transactionInfo = await models.scanningTransactionModel.findOne({ where: { id: req.body.trId }, raw: true });
      if (!transactionInfo) {
        return res.status(200).send({ success: 0, message: "transaction info not found" })
      }
      if (transactionInfo.status == 2) {
        return res.status(200).send({ success: 0, message: "Transaction Already Comeleted" })
      }
      let scannedData = await models.transactionChildModel.findAll({
        where: {
          transaction_id: req.body.trId,
        },
        // include: {
        //   model: scanningTransactionModel,
        //   raw: true
        // },
        raw: true,
        nest: true
      })

      if (scannedData.length <= 0) {
        return res.status(200).send({ success: 0, message: "No codes to discard" })
      }

      let specificCodes = [];
      let generalCodes = []
      scannedData.forEach(element => {

        let el = element;
        console.log(el);
        if (el.type == false) {
          specificCodes.push(el.scanned_code)
        }
        if (el.type == true) {
          generalCodes.push(el.scanned_code)
        }
      });


      console.log("----General Codes::", generalCodes);
      console.log("----Specific Codes::", specificCodes);

      let SpecificModel = await getDynamicModel(transactionInfo.packaging_level, transactionInfo.u_id);
      if (!SpecificModel) {
        return res.status(200).send({ success: 0, message: 'Specific Dynamic Model Not found' })
      }
      let GeneralModel = await getDynamicModel(transactionInfo.packaging_level, transactionInfo.gen_uid);
      if (!GeneralModel) {
        return res.status(200).send({ success: 0, message: 'General Dynamic Model Not found' })
      }

      // // Making codes to be available for scanning
      await SpecificModel.update({
        is_scanned: false
      }, {
        where: {
          unique_code: {
            [Op.in]: specificCodes
          }
        }
      })

      await GeneralModel.update({
        is_scanned: false
      }, {
        where: {
          unique_code: {
            [Op.in]: generalCodes
          }
        }
      })

      await models.transactionChildModel.destroy({
        where: {
          transaction_id: req.body.trId
        }
      })

      await models.scanningTransactionModel.update({
        mapped_count: 0
      }, {
        where: {
          id: req.body.trId
        }
      })
      return res.status(200).send({ success: 1, message: "Discarded Successfully." })
    }
    catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  deleteOther: async (req, res) => {
    try {
      let validator = new v(req.body, {
        trId: "required",
        code: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      let transactionInfo = await models.scanningTransactionModel.findOne({ where: { id: req.body.trId }, raw: true });
      if (!transactionInfo) {
        return res.status(200).send({ success: 0, message: "transaction info not found" })
      }
      let scannedData = await models.transactionChildModel.findOne({
        where: {
          transaction_id: req.body.trId,
          scanned_code: req.body.code
        },
        raw: true,
        nest: true
      })

      if (!scannedData) {
        return res.status(200).send({ success: 0, message: "Code Not Found" })
      }

      // let specificCode;
      // let generalCode;

      // let remainingCodes = [];
      // scannedData.forEach(element => {
      //   let el = element;
      //   // console.log(el);
      //   if (el.scanned_code == req.body.code) {
      //     if (el.type == false) {
      //       specificCode = el.scanned_code
      //     }
      //     if (el.type == true) {
      //       generalCode = el.scanned_code
      //     }
      //   }
      //   else {
      //     remainingCodes.push(element)
      //   }

      // });

      // console.log("After Scanned Codes::", remainingCodes);


      // console.log("----General Code::", generalCode);
      // console.log("----Specific Code::", specificCode);


      // if (!specificCode && !generalCode) {
      //   return res.status(200).send({ success: 0, message: "Code Not Found" })
      // }

      let UID = !scannedData.type ? transactionInfo.u_id : transactionInfo.gen_uid

      let CustomModel = await getDynamicModel(transactionInfo.packaging_level, UID);
      if (!CustomModel) {
        return res.status(200).send({ success: 0, message: 'Custom Model Not Found' })
      }

      await CustomModel.update({
        is_scanned: false
      }, {
        where: {
          unique_code: req.body.code
        }
      })

      await models.transactionChildModel.destroy({
        where: {
          transaction_id: req.body.trId,
          scanned_code: req.body.code
        }
      })

      await models.scanningTransactionModel.update({
        mapped_count: Sequelize.literal("mapped_count - 1")
      }, {
        where: {
          id: req.body.trId
        }
      })
      return res.status(200).send({ success: 1, message: "Deleted Successfully." })
    }
    catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  completeOther: async (req, res) => {
    try {
      if (OtherTRCompleteInProgress) {
        await sleep(2000);
      }
      OtherTRCompleteInProgress = true;
      let validator = new v(req.body, {
        trId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        OtherTRCompleteInProgress = false;
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let transactionInfo = await models.scanningTransactionModel.findOne({
        where: {
          id: req.body.trId,
          is_other: true
        },
        raw: true
      })
      if (!transactionInfo) {
        OtherTRCompleteInProgress = false;
        return res.status(200).send({ success: 0, message: "Transaction Not Found" })
      }

      if (transactionInfo.status == 2) {
        OtherTRCompleteInProgress = false;
        return res.status(200).send({ success: 0, message: "Transaction Already Completed" })
      }

      let scannedData = await models.transactionChildModel.findAll({
        where: {
          transaction_id: req.body.trId,
        },
        // include: {
        //   model: scanningTransactionModel,
        //   raw: true
        // },
        raw: true,
        nest: true
      })

      if (scannedData.length <= 0) {
        OtherTRCompleteInProgress = false;
        return res.status(200).send({ success: 0, message: "No codes to complete" })
      }
      let specificCodes = [];
      let generalCodes = []
      scannedData.forEach(element => {

        let el = element;
        console.log(el);
        if (el.type == false) {
          specificCodes.push(el.scanned_code)
        }
        if (el.type == true) {
          generalCodes.push(el.scanned_code)
        }
      });


      console.log("----General Codes::", generalCodes);
      console.log("----Specific Codes::", specificCodes);

      let SpecificModel = await getDynamicModel(transactionInfo.packaging_level, transactionInfo.u_id);
      if (!SpecificModel) {
        OtherTRCompleteInProgress = false;
        return res.status(200).send({ success: 0, message: 'Specific Dynamic Model Not found' })
      }
      let GeneralModel = await getDynamicModel(transactionInfo.packaging_level, transactionInfo.gen_uid);
      if (!GeneralModel) {
        OtherTRCompleteInProgress = false;
        return res.status(200).send({ success: 0, message: 'General Dynamic Model Not found' })
      }

      // // Making codes to be available for scanning
      await SpecificModel.update({
        is_scanned: false,
        is_active: true,
        completed_at: new Date(),
        completed_by: req.userId,
        transaction_id: req.body.trId
      }, {
        where: {
          unique_code: {
            [Op.in]: specificCodes
          }
        }
      })

      await GeneralModel.update({
        is_scanned: false,
        is_active: true,
        completed_at: new Date(),
        completed_by: req.userId,
        transaction_id: req.body.trId,
        assigned_product_id: transactionInfo.product_id,
        batch_id: transactionInfo.batch_id,
        storage_bin_id: transactionInfo.storage_bin
      }, {
        where: {
          unique_code: {
            [Op.in]: generalCodes
          }
        }
      })

      await models.scanningTransactionModel.update({
        status: 2,
      }, {
        where: {
          id: req.body.trId
        }
      })

      await models.transactionChildModel.destroy({
        where: {
          transaction_id: req.body.trId
        }
      })

      // await addOrUpdateStockSummary(
      //   req.locationId,
      //   scannedData.mapping_transaction.storage_bin,
      //   scannedData.mapping_transaction.product_id,
      //   scannedData.mapping_transaction.batch_id,
      //   scannedData.mapping_transaction.packaging_level,
      //   scannedData.scanned_codes.length)
      await models.ProductBatchModel.update({
        mapped_outers: Sequelize.literal(`mapped_outers + ${specificCodes.length + generalCodes.length}`)
      }, {
        where: {
          id: transactionInfo.batch_id
        }
      })
      OtherTRCompleteInProgress = false;
      return res.status(200).send({ success: 1, message: "Completed Successfully." })
    }
    catch (error) {
      console.log(error);
      logger.error(req, error.message);
      OtherTRCompleteInProgress = false;
      return res.status(500).send({ message: error.toString() });
    }
  },
};

async function getScanedCount(tId, masterInfo, packaging_type) {
  let primaryCount = 0;
  let secondaryCount = 0;
  let tertiaryCount = 0;
  let outerCount = 0;
  if (masterInfo.is_mapp_primary) {
    primaryCount = await models.transactionChildModel.count({ where: { transaction_id: tId, level: 'P' } });
  }
  if (masterInfo.is_mapp_secondary) {
    secondaryCount = await models.transactionChildModel.count({ where: { transaction_id: tId, level: 'S' } });

  }
  if (masterInfo.is_mapp_tertiary) {
    tertiaryCount = await models.transactionChildModel.count({ where: { transaction_id: tId, level: 'T' } });
  }
  if (masterInfo.is_mapp_outer) {
    outerCount = await models.transactionChildModel.count({ where: { transaction_id: tId, level: 'O' } });
  }
  if (packaging_type == 1) {
    outerCount = await models.transactionChildModel.count({ where: { transaction_id: tId, level: 'O' } });
  }
  return {
    primaryCount,
    secondaryCount,
    tertiaryCount,
    outerCount
  }
}

async function getDynamicModel(key, UID) {
  try {
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

async function splitCode(code) {
  try {
    let split1 = code.split('?')
    console.log("----Split1::", split1);

    let split2 = split1[1].split('~')
    console.log("----Split2::", split2);

    let level = split2[1].split(':')[1]
    console.log("----Level::", level);
    let uniqueCode = split2[2].split(':')[1]
    console.log("----Unique Code::", uniqueCode);
    let batch = split2[3].split(':')[1]
    console.log("----Batch::", batch);

    return {
      uniqueCode: uniqueCode,
      batch: batch,
      level: level
    }

  } catch (error) {
    console.log(error);
    return false
  }
}

async function getLevelCode(level) {
  return (level == 1 ? 'P' : level == 2 ? 'S' : level == 3 ? 'O' : 'T')
}

async function getCodeUID(code) {
  try {
    let dynamicUID = code[2] + code[6] + code[8];
    console.log("----Dynamic UID::", dynamicUID);
    let UIDInfo = await DynamicUIDModel.findOne({
      where: {
        code: dynamicUID
      },
      raw: true
    })
    if (UIDInfo) {
      console.log("----UID Found::", UIDInfo.u_id);
      return UIDInfo.u_id
    }
    else {
      console.log("----UID Not Found::");
      return false
    }
  } catch (error) {
    console.log(error);
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function addOrUpdateStockSummary(locationId, storageBin, productId, batchId, level, count) {

  let exists = await StockSummary.findOne({
    where: {
      location_id: locationId,
      storage_bin: storageBin,
      product_id: productId,
      batch_id: batchId,
      packaging_level: level, // P,S,T,O,
    },
    raw: true,
  })
  if (exists) {
    await StockSummary.update({
      qty: exists.qty + count,
    }, {
      where: {
        id: exists.id
      }
    })
    return true;
  } else {
    await StockSummary.create({
      id: uuid(),

      location_id: locationId,
      storage_bin: storageBin,
      product_id: productId,
      batch_id: batchId,
      packaging_level: level,

      qty: count,
    })
    return true;
  }
}

async function getLastParent(masterInfo) {
  try {
    let lastParent;
    if (masterInfo.is_mapp_outer) {
      lastParent = 'O'
    }
    else if (masterInfo.is_mapp_tertiary) {
      lastParent = 'T'
    }
    else if (masterInfo.is_mapp_secondary) {
      lastParent = 'S'
    }

    return lastParent;

  } catch (error) {
    console.log(error);
    return false;
  }
}

async function getUIDAndLevel(code) {
  let UID, level;
  let dynamicCode = code[2] + code[6] + code[8];
  let dynamicUID = await DynamicUIDModel.findOne({
    where: {
      code: dynamicCode
    },
    raw: true
  })

  if (!dynamicUID) {
    console.log("-------------Dynamic UID Not Found");
  } else {
    UID = dynamicUID.u_id
  }

  let dynamicLevel = await DynamicLevelCodesModel.findOne({
    where: {
      code: code[4],
      level: {
        [Op.ne]: null
      }
    },
    raw: true
  })
  console.log("dyanmic Level::", code[4], dynamicLevel);
  if (!dynamicLevel) {
    console.log("-------------,Level Not Found");
  } else {
    level = dynamicLevel.level
  }

  return {
    UID: UID,
    level: level
  }
}

async function findLevels(masterInfo, packagingLevel) {
  let isPackagingApplicable = false;
  let innerLevel;
  let hasLastChild = false;
  let packagingSize = 0;
  let hasParent = false;
  let hasParentLevel = null;
  let hasParentSize = 0;
  if (masterInfo.packaging_type == 2) {

    if (packagingLevel == 'S') {
      isPackagingApplicable = masterInfo.is_mapp_secondary
      innerLevel = 'S';
      if (masterInfo.is_mapp_primary) {

        innerLevel = 'P';
        hasLastChild = true;

        packagingSize = masterInfo.is_mapp_secondary ? masterInfo.secondary_size : masterInfo.is_mapp_tertiary ? masterInfo.tertiary_size : masterInfo.is_mapp_outer ? masterInfo.outer_size : masterInfo.outer_size;

      }
      else {
        packagingSize = masterInfo.is_mapp_tertiary ? masterInfo.tertiary_size : masterInfo.is_mapp_outer ? masterInfo.outer_size : masterInfo.outer_size;
      }

      if (masterInfo.is_mapp_tertiary) {
        hasParentLevel = 'T';
        hasParent = true;
        hasParentSize = masterInfo.is_mapp_tertiary ? masterInfo.tertiary_size : masterInfo.is_mapp_outer ? masterInfo.outer_size : masterInfo.outer_size;
      }
      else if (masterInfo.is_mapp_outer) {
        hasParentLevel = 'O';
        hasParent = true;
        hasParentSize = masterInfo.outer_size;
      }
    }

    else if (packagingLevel == 'T') {
      isPackagingApplicable = masterInfo.is_tertiary;
      innerLevel = 'T';

      if (masterInfo.is_mapp_secondary) {

        innerLevel = 'S';
        packagingSize = masterInfo.is_mapp_tertiary ? masterInfo.tertiary_size : masterInfo.is_mapp_outer ? masterInfo.outer_size : masterInfo.outer_size;

        hasLastChild = (masterInfo.is_mapp_primary ? false : true);

      }
      else if (masterInfo.is_mapp_primary) {

        innerLevel = 'P'
        hasLastChild = true;

        if (masterInfo.is_mapp_secondary) {
          packagingSize = masterInfo.secondary_size * masterInfo.tertiary_size;
        }
      } else {
        packagingSize = masterInfo.outer_size;
      }
      if (masterInfo.is_mapp_outer) {
        hasParentLevel = 'O';
        hasParent = true;
        hasParentSize = masterInfo.outer_size;
      }
    }
    else if (packagingLevel == 'O') {
      console.log();
      isPackagingApplicable = true;

      if (masterInfo.is_mapp_tertiary) {

        innerLevel = 'T';
        hasLastChild = ((masterInfo.is_mapp_secondary || masterInfo.is_mapp_primary) ? false : true)

        packagingSize = masterInfo.outer_size;


      } else if (masterInfo.is_mapp_secondary) {


        innerLevel = 'S';
        hasLastChild = (masterInfo.is_mapp_primary ? false : true);

        if (masterInfo.is_tertiary) {
          packagingSize = masterInfo.tertiary_size * masterInfo.outer_size;
        }
        else {
          packagingSize = masterInfo.outer_size;
        }

      } else if (masterInfo.is_mapp_primary) {

        innerLevel = 'P';
        hasLastChild = true;

        if (masterInfo.is_tertiary) {
          if (masterInfo.is_mapp_secondary) {
            packagingSize = masterInfo.secondary_size * masterInfo.tertiary_size * masterInfo.outer_size;
          } else {
            packagingSize = masterInfo.tertiary_size * masterInfo.outer_size;
          }
        }
        else {
          if (masterInfo.is_mapp_secondary) {
            packagingSize = masterInfo.secondary_size * masterInfo.outer_size;
          }
          else {
            packagingSize = masterInfo.outer_size
          }
        }

      }

    }
  }
  else {
    // Single product Case
    if (packagingLevel == 'O') {
      // packagingSize = productInfo.outer_size;
      packagingSize = true;  // Packaging size is not applicable to single product
      isPackagingApplicable = true
    }
    else {
      isPackagingApplicable = false
    }
  }
  return { packagingSize, isPackagingApplicable, innerLevel, hasLastChild, hasParent, hasParentLevel, hasParentSize }
}

async function varifyCodes(code) {
  try {
    let level;
    let uniqueCode;
    let UID;
    let key;
    let batch;
    // let type = global.config.codeType;
    if ((code.includes(global.config.codeUrl) || code.includes(global.config.mankindURL))) {
      // if (type == 1) {
      code = code.replace('http://', '');
      code = code.replace('https://', '');
      code = code.replace('HTTP://', '');
      code = code.replace('HTTPS://', '');
      let split1 = code.split('/');
      let split2 = split1[6].split('?');
      let values = await getUIDAndLevel(split2[0]);
      batch = split1[4];
      UID = values.UID;
      key = values.level;
      level = values.level == 'P' ? 1 : values.level == 'S' ? 2 : values.level == 'O' ? 3 : 4;
      uniqueCode = split2[0];

    }
    else if (code.length > 13) {
      let split1 = code.split('?');
      let split2 = split1[1].split('~');
      level = split2[1].split(':')[1];
      uniqueCode = split2[2].split(':')[1];
    }
    else {
      let values = await getUIDAndLevel(code);
      UID = values.UID;
      key = values.level;
      level = values.level == 'P' ? 1 : values.level == 'S' ? 2 : values.level == 'O' ? 3 : 4;
      uniqueCode = code;
    }

    return { level, uniqueCode, key, batch }
  }
  catch (error) {
    return { level: null, uniqueCode: '' }
  }
}
async function verifyCodeLevel(info) {
  let counts = {
    primaryCount: info.p_lvl,
    secondaryCount: info.s_lvl,
    tertiaryCount: info.t_lvl,
    outerCount: info.o_lvl
  };
  let masterInfo = {
    is_mapp_primary: info.product_batch.is_mapp_primary,
    is_mapp_secondary: info.product_batch.is_mapp_secondary,
    is_mapp_tertiary: info.product_batch.is_mapp_tertiary,
    is_mapp_outer: info.product_batch.is_mapp_outer,
    secondary_size: info.product_batch.secondary_size,
    tertiary_size: info.product_batch.tertiary_size,
    outer_size: info.product_batch.outer_size
  }
  if (masterInfo.is_mapp_secondary && masterInfo.secondary_size == 0) {
    return { newLevel: null, counts }
  }
  if (masterInfo.is_mapp_tertiary && masterInfo.tertiary_size == 0) {
    return { newLevel: null, counts }
  }
  if (masterInfo.is_mapp_outer && masterInfo.outer_size == 0) {
    return { newLevel: null, counts }
  }
  if (!masterInfo.is_mapp_secondary && !masterInfo.is_mapp_tertiary && !masterInfo.is_mapp_outer && !masterInfo.is_mapp_primary) {
    return { newLevel: 'O', counts };
  }
  let time = new Date().getTime();

  let primarySize = 0;
  let secondarysize = [null].includes(Number(masterInfo.secondary_size)) ? 0 : Number(masterInfo.secondary_size);
  let tertiarySize = [null].includes(Number(masterInfo.tertiary_size)) ? 0 : Number(masterInfo.tertiary_size);
  let outerSize = [null].includes(Number(masterInfo.outer_size)) ? 0 : Number(masterInfo.outer_size);
  let Primarytotal = 1 * (masterInfo.secondary_size > 0 ? secondarysize : 1) * (masterInfo.tertiary_size > 0 ? tertiarySize : 1) * (masterInfo.outer_size > 0 ? outerSize : 1);
  let secondaryTotal = 1 * (masterInfo.tertiary_size > 0 ? tertiarySize : 1) * (masterInfo.is_mapp_outer ? outerSize : 1);
  let tertiaryTotal = 1 * (masterInfo.outer_size > 0 ? outerSize : 1);
  let outerTotal = 1;
  let total = (true ? Primarytotal : 0) + (masterInfo.secondary_size > 0 ? secondaryTotal : 0) + (masterInfo.tertiary_size > 0 ? tertiaryTotal : 0) + (masterInfo.outer_size > 0 ? outerTotal : 0);
  // console.log(` ${Primarytotal} + ${secondaryTotal} + ${tertiaryTotal} + ${outerTotal}`, total);
  const result = await levelVerify(info.product_batch, counts);
  let level = result.level;
  counts = result.counts;
  if (info.product_batch.packaging_type == 1) {
    level = 'O';
  }
  // let finalCount = result.counts;
  // console.log(data);
  // console.log(counts);
  // console.log((new Date().getTime() - time), 'milli sec');
  return { newLevel: level, counts }
};

async function levelVerify(masterInfo, counts) {
  masterInfo = masterInfo;
  let level;
  if (masterInfo.outer_size > 0 && counts.tertiaryCount % (masterInfo.outer_size) == 0 && counts.tertiaryCount > 0) {
    // console.log("outer Turn");
    counts.outerCount += 1;
    counts.tertiaryCount = 0;
    counts.secondaryCount = 0;
    counts.primaryCount = 0;
    if (masterInfo.is_mapp_outer != false) {
      // data.push({ x: 1, level: 'O' });
      return { level: 'O', counts };
    }
    else {
      const result = await levelVerify(masterInfo, counts);
      level = result.level;
      counts = result.counts;
      return { level, counts };
    }

  }
  else if (masterInfo.tertiary_size > 0 && counts.secondaryCount % (masterInfo.tertiary_size) == 0 && counts.secondaryCount > 0) {
    if (masterInfo.outer_size > 0) {
      counts.tertiaryCount += 1;
      counts.secondaryCount = 0;
      counts.primaryCount = 0;
    }
    // console.log("Tersi Turn");
    counts.secondaryCount = 0;
    counts.primaryCount = 0;
    if (masterInfo.is_mapp_tertiary == true) {
      // data.push({ x: 1, level: 'T' });
      return { level: 'T', counts };
    }
    else {
      const result = await levelVerify(masterInfo, counts);
      level = result.level;
      counts = result.counts;
      return { level, counts };
    }
    // counts.primaryCount = 0;
  }
  else if (masterInfo.secondary_size > 0 && counts.primaryCount % masterInfo.secondary_size == 0 && counts.primaryCount > 0) {
    if (masterInfo.tertiary_size > 0) {
      counts.secondaryCount += 1;
      counts.primaryCount = 0;
    }
    else if (masterInfo.outer_size > 0) {
      counts.tertiaryCount += 1;
      counts.primaryCount = 0;
    }
    // console.log("Secondary Turn");
    if (masterInfo.is_mapp_secondary == true) {
      // data.push({ x: 1, level: 'S' });
      return { level: 'S', counts };
    }
    else {
      const result = await levelVerify(masterInfo, counts);
      level = result.level;
      counts = result.counts;
      return { level, counts };
    }
  }
  else if (masterInfo.is_mapp_primary == true) {
    // if (masterInfo.secondary_size > 0) {
    //   counts.primaryCount += 1;
    // }
    // else if (masterInfo.tertiary_size > 0) {
    //   if (masterInfo.is_mapp_secondary) {
    //     counts.secondaryCount += 1;
    //     counts.primaryCount = 0;
    //   }
    //   else {
    //     counts.primaryCount += 1;
    //   }
    // }
    // else if (masterInfo.outer_size > 0) {
    //   if (masterInfo.is_mapp_tertiary) {
    //     counts.tertiaryCount += 1;
    //     counts.secondaryCount = 0;
    //     counts.primaryCount = 0;
    //   }
    //   else if (masterInfo.is_mapp_secondary) {
    //     counts.secondaryCount += 1;
    //     counts.primaryCount = 0;
    //   } else {
    //     counts.primaryCount += 1;
    //   }
    // }
    if (masterInfo.secondary_size > 0) {
      counts.primaryCount += 1;
    }
    else if (masterInfo.tertiary_size > 0) {
      counts.secondaryCount += 1;
      counts.primaryCount = 0;
    }
    else if (masterInfo.outer_size > 0) {
      counts.tertiaryCount += 1;
      counts.secondaryCount = 0;
      counts.primaryCount = 0;
    }
    console.log(counts.tertiaryCount, "primary Turn");
    if (masterInfo.is_mapp_primary == true) {
      // data.push({ x: 1, level: 'P' });
      return { level: 'P', counts };
    }
    else {
      const result = await levelVerify(masterInfo, counts);
      level = result.level;
      counts = result.counts;
      return { level, counts };
    }
  }
  else {
    if (masterInfo.secondary_size > 0) {
      if (masterInfo.tertiary_size > 0) {
        counts.secondaryCount += 1;
        counts.primaryCount = 0;
      }
      else if (masterInfo.outer_size > 0) {
        counts.tertiaryCount += 1;
        counts.secondaryCount = 0;
        counts.primaryCount = 0;
      }
      if (masterInfo.is_mapp_secondary == true) {
        // data.push({ x: 1, level: 'S' });
        return { level: 'S', counts };
      }
      else {
        if (masterInfo.is_mapp_tertiary) {
          counts.secondaryCount = masterInfo.tertiary_size;
          counts.primaryCount = 0;
        }
        else if (masterInfo.is_mapp_outer) {
          counts.tertiaryCount = masterInfo.outer_size;
          counts.secondaryCount = 0;
          counts.primaryCount = 0;
        }
        const result = await levelVerify(masterInfo, counts);
        level = result.level;
        counts = result.counts;
        return { level, counts };
      }
    }
    else if (masterInfo.tertiary_size > 0) {
      if (masterInfo.outer_size > 0) {
        counts.tertiaryCount += 1;
        counts.secondaryCount = 0;
        counts.primaryCount = 0;
      }
      counts.secondaryCount = 0;
      counts.primaryCount = 0;
      if (masterInfo.is_mapp_tertiary == true) {
        // data.push({ x: 1, level: 'T' });
        return { level: 'T', counts };
      }
      else {
        if (masterInfo.is_mapp_outer) {
          counts.tertiaryCount = masterInfo.outer_size;
          counts.secondaryCount = 0;
          counts.primaryCount = 0;
        }
        const result = await levelVerify(masterInfo, counts);
        level = result.level;
        counts = result.counts;
        return { level, counts };
      }
    }
    else if (masterInfo.outer_size > 0) {
      //   counts.outerCount += 1;
      counts.tertiaryCount = 0;
      counts.secondaryCount = 0;
      counts.primaryCount = 0;
      if (masterInfo.is_mapp_outer != false) {
        return { level: 'O', counts };
        // data.push({ x: 1, level: 'O' });
      }
      else {
        return { level: 'O', counts };
        // data.push({ x: 1, level: 'O' });
        // levelVerify();
      }
    }
  }
  return { level: null, counts };
}


async function getcodeCounts(masterInfo, transactionInfo) {
  let PC = 1 * masterInfo.outer_size * (!masterInfo.is_mapp_tertiary && !masterInfo.is_mapp_secondary ? masterInfo.tertiary_size : 1) * (!masterInfo.is_mapp_secondary ? masterInfo.secondary_size : 1);
  let SC = 1 * masterInfo.outer_size * (!masterInfo.is_mapp_tertiary ? masterInfo.tertiary_size : 1);
  let TC = 1 * masterInfo.outer_size;
  let OC = 1;
  let primary = masterInfo.is_mapp_primary ? PC : 0;
  let secondary = masterInfo.is_mapp_secondary ? SC : 0;
  let tertiary = masterInfo.is_mapp_tertiary ? TC : 0;
  let outer = masterInfo.is_mapp_outer ? OC : 1;
  let codes = {
    primary,
    secondary,
    tertiary,
    outer
  }
  return codes;
}

async function parentLvl(codeLevel, masterInfo) {
  let outerLevel = null;
  if (codeLevel == 'P') {
    if (masterInfo.is_mapp_secondary) {
      outerLevel = 'S';
    }
    else if (masterInfo.is_mapp_tertiary) {
      outerLevel = 'T';
    }
    else {
      outerLevel = 'O';
    }
  }
  else if (codeLevel == 'S') {
    if (masterInfo.is_mapp_tertiary) {
      outerLevel = 'T';
    }
    else {
      outerLevel = 'O';
    }
  }
  else if (codeLevel == 'T') {
    outerLevel = 'O';
  }
  else if (codeLevel == 'O') {
    outerLevel = null;
  }
  return outerLevel;
};

async function getOuterParentCodes(codeFound, specificUID, productInfo) {
  let level = {
    'P': 1,
    'S': 2,
    'T': 3,
    'O': 4
  };
  let parentLevel = level[`${codeFound.parent_level}`];
  let availableLevel = {
    1: productInfo.is_mapp_primary,
    2: productInfo.is_mapp_secondary,
    3: productInfo.is_mapp_tertiary,
    4: productInfo.is_mapp_outer
  };
  for (let index = parentLevel; index <= 4; index++) {
    if (availableLevel[index] || index == 4) {
      let parent1 = await getCodeInfoById1(codeFound.mapped_to_parent, codeFound.parent_level, specificUID);
      if ((parent1.parent_level == null && (parent1.is_mapped == true || parent1.is_complete == true)) || index == 4) {
        return parent1;
      } else {
        return await getOuterParentCodes(parent1, specificUID, productInfo);
      }
    }
  }
}

async function getAllChildCodes(codeFound, specificUID, productInfo) {
  let codes = {
    1: [],
    2: [],
    3: [],
    4: [codeFound.id]
  };
  let availableLevel = {
    1: productInfo.is_mapp_primary,
    2: productInfo.is_mapp_secondary,
    3: productInfo.is_mapp_tertiary,
    4: productInfo.is_mapp_outer
  };
  let activeLevels = [];
  for (let index = 1; index <= 4; index++) {
    if (availableLevel[index]) {
      activeLevels.push(index)
    }
  }

  let y = activeLevels.length;
  for (let index = 3; index >= 1; index--) {
    if (availableLevel[index + 1]) {
      let level = activeLevels[y - 2] == 1 ? 'P' : activeLevels[y - 2] == 2 ? 'S' : activeLevels[y - 2] == 3 ? 'T' : 'O';
      let codeSchema = await getDynamicModel(level, specificUID);
      let getChildCodes = await codeSchema.findAll({
        where: {
          is_replaced: false,
          mapped_to_parent: { [Op.in]: activeLevels[y - 1] == 4 ? [codeFound.id] : codes[activeLevels[y - 1]] }
        },
        attributes: ["id", "is_replaced", "storage_bin"],
        raw: true
      });
      if (type = 1) {
        codes[activeLevels[y - 2]] = getChildCodes.map(x => x.id);
      }
      else {
        codes[activeLevels[y - 2]] = getChildCodes;
      }
      y--;
    }
  }
  return codes;
}

async function getVerifyAllChildCodes(codeFound, specificUID, productInfo, locationId, genProductInfo) {
  let codes = {
    1: [],
    2: [],
    3: [],
    4: [codeFound.id]
  };
  let generalCodes = {
    1: [],
    2: [],
    3: [],
    4: []
  }
  if (codeFound.is_general) {
    generalCodes[4] = [codeFound.id];
  }
  let availableLevel = {
    1: productInfo.is_mapp_primary,
    2: productInfo.is_mapp_secondary,
    3: productInfo.is_mapp_tertiary,
    4: productInfo.is_mapp_outer
  };
  let activeLevels = [];
  for (let index = 1; index <= 4; index++) {
    if (availableLevel[index]) {
      activeLevels.push(index)
    }
  }

  let y = activeLevels.length;
  for (let index = 3; index >= 1; index--) {
    if (availableLevel[index + 1]) {
      let level = activeLevels[y - 2] == 1 ? 'P' : activeLevels[y - 2] == 2 ? 'S' : activeLevels[y - 2] == 3 ? 'T' : 'O';
      let codeSchema = await getDynamicModel(level, specificUID);
      let getChildCodes = await codeSchema.findAll({
        where: {
          is_replaced: false,
          mapped_to_parent: { [Op.in]: activeLevels[y - 1] == 4 ? [codeFound.id] : codes[activeLevels[y - 1]] }
        },
        include: [
          {
            model: StorageBinModel,
            raw: true
          }
        ],
        // attributes: ["id", "is_replaced", "storage_bin_id","has_parent"],
        raw: true,
        nest: true,
      });

      let generalCodeScheme = await getDynamicModel(level, genProductInfo.u_id);
      let generalChildCode = await generalCodeScheme.findAll({
        where: {
          mapped_to_parent: { [Op.in]: activeLevels[y - 1] == 4 ? [codeFound.id] : codes[activeLevels[y - 1]] }
        },
        include: [
          {
            model: StorageBinModel,
            raw: true
          }
        ],
        // attributes: ["id", "is_replaced", "storage_bin_id","has_parent"],
        raw: true,
        nest: true,
      });

      // if (generalChildCode.length > 0) {
      //   getChildCodes = [...getChildCodes, ...generalChildCode];
      // }

      if (getChildCodes.some(x => x.is_replaced == true)) {
        return { success: 0, message: "Code has Replaced" };
      }
      if (getChildCodes.some(x => x.storage_bin.location_id != locationId)) {
        return { success: 0, message: "Code not Found" };
      }
      if (getChildCodes.some(x => x.is_box_opened == true)) {
        return { success: 0, message: "Code has Open" };
      }
      if (getChildCodes.some(x => x.is_in_consignment == true)) {
        return { success: 0, message: "Code Is In Consignment" };
      }
      if (getChildCodes.some(x => level != "O" ? x.is_mapped == false : is_complete == false)) {
        return { success: 0, message: "Code has De-aggregated" };
      }
      codes[activeLevels[y - 2]] = getChildCodes.map(x => x.id);

      if (generalChildCode.length > 0) {
        generalCodes[activeLevels[y - 2]] = generalChildCode.map(x => x.id);
      }
      y--;
    }
  }
  return { success: 1, data: { codes, generalCodes }, message: "" };
}

async function getCodeInfoById(codeId, level, specificUID) {
  try {
    console.log("--TableUID::", specificUID);
    console.log("----Get Code By Id Called::",);
    let genProductInfo = await getGeneralProductInfo();
    if (!genProductInfo) {
      console.log("General Product Not Found");
      return false
    }

    // First check in General
    let generalModel = await getDynamicModel(level, genProductInfo.u_id);
    if (!generalModel) {
      console.log("General Model 1 Not Found");
      return false;
    }

    let codeDetails = await generalModel.findOne({
      where: {
        id: codeId
      },
      include: [
        {
          model: StorageBinModel,
          raw: true
        }
      ],
      raw: true,
      nest: true
    })
    if (!codeDetails) {  // If not found in General
      console.log("----Not A General Code");
      let CustomModel = await getDynamicModel(level, specificUID);
      codeDetails = await CustomModel.findOne({
        where: {
          id: codeId
        },
        include: [
          {
            model: StorageBinModel,
            raw: true
          }
        ],
        raw: true,
        nest: true
      })
      if (codeDetails) {
        console.log("----Yes It Is A Specific Code");
        codeDetails.level = level;
        codeDetails.u_id = specificUID;
        codeDetails.CustomModel = CustomModel;
        return codeDetails
      } else {
        console.log("----Not A Specific Code");
        return false;
      }
    } else {
      console.log("----Yes It Is A General Code");
      codeDetails.level = level;
      codeDetails.u_id = genProductInfo.u_id;
      codeDetails.CustomModel = generalModel;
      return codeDetails;
    }
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function getCodeInfoById1(codeId, level, specificUID) {
  let codeSchema = await getDynamicModel(level, specificUID);

  let codesDetails = await codeSchema.findOne({
    where: {
      id: codeId
    },
    // attributes: ['id','',''],
    raw: true
  });

  return codesDetails;
}

async function unmapCodes(codesList, specificUID, userId, genProductInfo) {
  for (let index = 1; index <= 4; index++) {
    const element = codesList.codes[index];
    if (element.length > 0) {
      let level = index == 1 ? 'P' : index == 2 ? 'S' : index == 3 ? 'T' : 'O';
      let codeSchema = await getDynamicModel(level, specificUID);
      for (let i = 0; i < element.length; i++) {
        const element1 = element[i];
        await codeSchema.update({
          mapped_to_parent: null,
          is_mapped: false,
          is_complete: false,
          parent_level: null,
          unmapped_by: userId,
          unmapped_at: new Date(),
        }, {
          where: {
            id: element1
          }
        });
      }
    }
  }
}

async function dropCodes(codesList, specificUID, userId) {
  for (let index = 1; index <= 4; index++) {
    const element = codesList[index];
    if (element.length > 0) {
      let level = index == 1 ? 'P' : index == 2 ? 'S' : index == 3 ? 'T' : 'O';
      let codeSchema = await getDynamicModel(level, specificUID);
      for (let i = 0; i < element.length; i++) {
        const element1 = element[i];
        await codeSchema.update({
          // mapped_to_parent: null,
          // is_mapped: false,
          // is_complete: false,
          // parent_level: null,
          // unmapped_by: userId,
          // unmapped_at: new Date(),
          is_dropped: true,
          dropped_by: userId,
          dropped_at: new Date()
        }, {
          where: {
            id: element1
          }
        });
      }
    }
  }
}
//===========unmap Code Function========================================



async function validateParent(codeFound, specificUID) {
  try {
    console.log("----Validate Parent Called::", specificUID, "Level::", codeFound.parent_level);

    // Here Parent Will be Returned From any , i.e either General/ Specific
    let parent1 = await getCodeInfoById(codeFound.mapped_to_parent, codeFound.parent_level, specificUID);
    if (!parent1) {
      return { success: 0, message: `Parent ${codeFound.parent_level} Not Found` }
    }
    else {
      // V2 Getting Location Id To allocate same to childs and Update Stock Count
      let lastLocationInfo = await getLastLocationInfo(parent1, specificUID);
      if (lastLocationInfo.success == 1) {
        return { success: 1, data: parent1 };
      }
      else {
        return lastLocationInfo;  // success:0, message:'XYZ'
      }
    }
  } catch (error) {
    console.log(error);
    return { success: 0, message: "Error In Validating Parent" }
  }
}

async function getCodeInfoById(codeId, level, specificUID) {
  try {
    console.log("--TableUID::", specificUID);
    console.log("----Get Code By Id Called::",);
    let genProductInfo = await getGeneralProductInfo();
    if (!genProductInfo) {
      console.log("General Product Not Found");
      return false
    }

    // First check in General
    let generalModel = await getDynamicModel(level, genProductInfo.u_id);
    if (!generalModel) {
      console.log("General Model 1 Not Found");
      return false;
    }

    let codeDetails = await generalModel.findOne({
      where: {
        id: codeId
      },
      include: [
        {
          model: StorageBinModel,
          raw: true
        }
      ],
      raw: true,
      nest: true
    })
    if (!codeDetails) {  // If not found in General
      console.log("----Not A General Code");
      let CustomModel = await getDynamicModel(level, specificUID);
      codeDetails = await CustomModel.findOne({
        where: {
          id: codeId
        },
        include: [
          {
            model: StorageBinModel,
            raw: true
          }
        ],
        raw: true,
        nest: true
      })
      if (codeDetails) {
        console.log("----Yes It Is A Specific Code");
        codeDetails.level = level;
        codeDetails.u_id = specificUID;
        codeDetails.CustomModel = CustomModel;
        return codeDetails
      } else {
        console.log("----Not A Specific Code");
        return false;
      }
    } else {
      console.log("----Yes It Is A General Code");
      codeDetails.level = level;
      codeDetails.u_id = genProductInfo.u_id;
      codeDetails.CustomModel = generalModel;
      return codeDetails;
    }
  } catch (error) {
    console.log(error);
    return false;
  }
}

// Self Calling Function To Know Last Location Of Active Parent
async function getLastLocationInfo(codeInfo, specificUID) {
  try {
    let lastLocationId = codeInfo.storage_bin.location_id;
    let lastStorageBinId = codeInfo.storage_bin_id;

    if (codeInfo.is_mapped && codeInfo.mapped_to_parent) {
      let parentData = await getCodeInfoById(codeInfo.mapped_to_parent, codeInfo.parent_level, specificUID);
      if (!parentData) {
        return { success: 0, message: `Parent ${codeInfo.parent_level} Not Found` }
      }
      else {
        let lastLocationInfo = await getLastLocationInfo(parentData, specificUID);
        return lastLocationInfo;
      }
    }
    else {
      return { success: 1, data: { lastLocationId: lastLocationId, lastStorageBinId: lastStorageBinId } }
    }

  } catch (error) {
    console.log(error);
    return { success: 0, message: "Error In Getting Last Location" }
  }
}

async function markBoxAsOpened(parentData, specificUID) {

  // Get General Models as well there can be general childs as well

  let genProductInfo = await getGeneralProductInfo();
  if (!genProductInfo) {
    console.log("General Product Not Found");
    return false
  }

  // console.log("parentData::", parentData);
  let ParentModel = parentData.CustomModel  // This Can Be Any General/SPecific
  await ParentModel.update({
    is_box_opened: true
  }, {
    where: {
      id: parentData.id
    }
  })

  // V2 If Any Box Is Opened Then assignning all the childs their storage bin and marking has_parent=false  :: Kapil
  let ChildLevel = parentData.childLevel;
  // let UID = parentData.UID;
  if (ChildLevel && specificUID) {
    // console.log(">>>>>>>>>>>>>>>Changing Storage Bin Of Childs");

    // Specific Childs
    let ChildModel = await getDynamicModel(ChildLevel, specificUID);  // This will be Specific Always
    await ChildModel.update({
      // storage_bin_id: parentData.storage_bin_id,
      // has_parent: false
      mapped_to_parent: null,
      is_mapped: false,
      is_complete: false,
      parent_level: null,
      unmapped_by: null,
      unmapped_at: new Date()
    }, {
      where: {
        is_replaced: false,
        mapped_to_parent: parentData.id
      }
    })

    // General Childs
    let generalUID = await getGeneralUID()
    let GeneralChildModel = await getDynamicModel(ChildLevel, generalUID);
    await GeneralChildModel.update({
      // storage_bin_id: parentData.storage_bin_id,
      // has_parent: false
      mapped_to_parent: null,
      is_mapped: false,
      is_complete: false,
      parent_level: null,
      unmapped_by: null,
      unmapped_at: new Date()
    }, {
      where: {
        is_replaced: false,
        mapped_to_parent: parentData.id
      }
    })


  }
  return true;
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

async function getGeneralUID() {
  let genProductInfo = await getGeneralProductInfo();
  if (!genProductInfo) {
    console.log("General Product Not Found");
    return false
  }
  return genProductInfo.u_id;
}

async function getBatchInfo(batchId) {
  return await ProductBatchModel.findOne({
    where: {
      id: batchId,
    },
    raw: true
  })
}

async function getProductInfo(productId) {
  return await ProductModel.findOne({
    where: {
      id: productId,
    },
    raw: true
  })
}

//============================== axios functions ==============================================
async function axiosPost(url, body) {

  options.headers["access-token"] = await generateJWTToken();
  return await axios.post(url, body, options)
    .then(async (res) => {
      if (res.status == 200) {
        if (res.data.success == 1) {
          // console.log(res.data, res.data.message)
          return [true, res.data, res.data.message];
        }
        if (res.data.success == 0) {
          return [false, res.data, res.data.message];
          // throw Error(res.data.message);
        }
      }
    })
    .catch(async (error) => {
      console.log(">>>>>>>>>catch Error", error);
      return [false, null, "Interneal Cloude Server Error"];
    });
};
async function axiosGet(url) {
  options.headers["access-token"] = await generateJWTToken();
  return await axios.get(url, options)
    .then(async (res) => {
      if (res.status == 200) {
        if (res.data.success == 1) {
          return [true, res.data, res.data.message];
        }
        if (res.data.success == 0) {
          return [false, res.data, res.data.message];
          // throw Error(res.data.message);
        }
      }
    })
    .catch(async (error) => {
      console.log(error.error.message);
      return [false, null, error.error.message];
    });
};
//==============================  End axios functions ============================== 

//============================== sync Token ========================================
async function generateJWTToken() {
  return await JWT.sign({
    mId: models.mId
  }, global.config.jwt.local.privateKey, {
    algorithm: global.config.jwt.local.alg,
    expiresIn: global.config.jwt.local.expIn
  });
};
//============================== End Sync Token ====================================