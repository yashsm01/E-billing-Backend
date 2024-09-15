
// libraries
const v = require("node-input-validator");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const moment = require('moment')
const uuid = require("uuid");
const { Client } = require("pg");
const path = require("path");


// middlewares
const parseValidate = require('./../middleware/parseValidate')
const logger = require("../helpers/logger");

//Models
const LocationModel = require("../models").locations;
const ProductModel = require("../models").products;
const ProductionOrderModel = require("../models/").production_orders;
const ProductBatchModel = require('../models/').product_batches;
const PrimaryQrCodeParent = require('../models').primary_qrcode_parents;
const SecondaryQrCodeParent = require('../models').secondary_qrcode_parents;
const TertiaryQrCodeParent = require('../models').tertiary_qrcode_parents;
const OuterQrCodeParent = require('../models').outer_qrcode_parents;
const MappingTransactionModel = require('../models').mapping_transactions;
const CompanyUsers = require('../models').company_users;
const Devices = require('../models').devices;
const ERPTransferModel = require('../models').erp_transfers;
const CustomerCareModel = require("../models/").customer_care;

// Controllers
const commonController = require('../controllers/common');
const erpConTroller = require('../controllers/erp');



/**
* @owner Kapil
* @description Production Order
*/

module.exports = {
  add: async (req, res) => {
    try {
      let validator = new v(req.body, {
        productId: "required",
        poNumber: "required",
        batchSize: "required",
        batchNo: "required",
        mfgDate: "required",
        expDate: "required",
        locationId: "required",
        caseMRP: "required",
        poDate: "required",
        isThirdParty: "required",
      });
      console.log("body", req.body);
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: "0", message: validatorError });
      }
      req.body.productId = req.body.productId[0].item_id;
      let productInfo = await ProductModel.findOne({
        where: {
          id: req.body.productId
        },
        include: [
          {
            model: CustomerCareModel,
            raw: true,
            as: 'customer_care'
          }
        ],
        raw: true,
        nest: true
      });

      if (!productInfo) {
        return res.status(200).send({ success: 0, message: "Item Not Found" });
      }

      if (productInfo.customer_care.id == null) {
        return res.status(200).send({ success: 0, message: "Marketed By Missing In Product" });
      }
      let locationInfo = await LocationModel.findOne({
        where: {
          id: req.body.locationId
        },
        raw: true
      })

      if (!locationInfo) {
        return res.status(200).send({ success: 0, message: "Location Not Found" })
      }

      if (req.body.batchNo.includes(' ')) {
        return res.status(200).send({ success: 0, message: "Space Not allowd in BatchNo" })
      }

      req.body.batchSize = Number(req.body.batchSize);
      req.body.batchNo = req.body.batchNo.toUpperCase().trim();
      if (req.body.batchSize <= 0) {
        return res.status(200).send({ success: 0, message: "Batch size should be greator than 0" })
      }


      let batchFound = await ProductBatchModel.findOne({
        where: {
          batch_no: req.body.batchNo.toUpperCase(),
          product_id: req.body.productId
        },
        // attributes: ['id'],
        raw: true
      })

      let primaryCodes = 0, secondaryCodes = 0, tertiaryCodes = 0, outerCodes = 0;
      // Outer Codes
      let tenPercent = (req.body.batchSize * 0.1) > 5 ? Number(req.body.batchSize * 0.1) : 5
      // outerCodes = req.body.batchSize + tenPercent
      // outerCodes = req.body.batchSize + 0; //old
      // outerCodes = Math.round(outerCodes); //old
      console.log("batchFound::", batchFound);
      let packagingType = batchFound ? batchFound.packaging_type : productInfo.packaging_type;
      let masterInfo = batchFound ? batchFound : productInfo;
      console.log("packagingType::", packagingType);
      // if (packagingType != 1) {   // If Packaging type is multi
      //   let codesCount = await CalculateNoOfCodes(masterInfo, req.body.batchSize);
      //   primaryCodes = Math.round(codesCount.primaryCodes);
      //   secondaryCodes = Math.round(codesCount.secondaryCodes);
      //   tertiaryCodes = Math.round(codesCount.tertiaryCodes);
      // }
      outerCodes = req.body.OCount > 0 ? Math.round(req.body.OCount) : 0;
      tertiaryCodes = req.body.TCount > 0 ? Math.round(req.body.TCount) : 0;
      secondaryCodes = req.body.SCount > 0 ? Math.round(req.body.SCount) : 0;
      primaryCodes = req.body.PCount > 0 ? Math.round(req.body.PCount) : 0;



      let batchId;
      let mfg = new Date(req.body.mfgDate);

      let mfgYear = mfg.getFullYear();
      if (mfgYear < 2010 || mfgYear > 2100) {
        return res.status(200).send({ success: 0, message: "Mfg Year Should Be Between 2010-2100" })
      }

      let mrp = (Math.round((Number(req.body.caseMRP) + Number.EPSILON) * 100) / 100).toFixed(2);
      if (batchFound) {
        batchId = batchFound.id;
        mrp = batchFound.mrp;
        // return res.status(200).send({ success: 0, message: "Batch already exists against this SKU" })
      } else {
        batchId = uuid()
      }

      let PoExists = await ProductionOrderModel.findOne({
        where: {
          po_number: req.body.poNumber,
          location_id: locationInfo.id,
          is_from_erp: productInfo.customer_care.manual_po_status ? true : false
        }
      })
      if (PoExists) {
        return res.status(200).send({ success: 0, message: "PO Already Exists" })
      }
      let poId = uuid();
      let obj = {
        id: poId,
        product_id: req.body.productId,
        po_number: req.body.poNumber,
        batch_size: req.body.batchSize,
        batch_no: req.body.batchNo.toUpperCase(),
        batch_id: batchId,
        location_id: locationInfo.id,
        po_date: new Date(req.body.poDate),
        primary_codes: primaryCodes,
        secondary_codes: secondaryCodes,
        tertiary_codes: tertiaryCodes,
        outer_codes: outerCodes,
        created_by: req.userId,
        po_code: req.body.poCode,
        is_from_erp: productInfo.customer_care.manual_po_status ? true : false,
        url: productInfo.customer_care.is_3p ? productInfo.customer_care.url : null,
        code_prefix: productInfo.customer_care.serialize_status ? productInfo.customer_care.code_prefix : null,
        serialize_digit: productInfo.customer_care.serialize_status ? productInfo.customer_care.serialize_digit : 0,
        serialize_status: productInfo.customer_care.serialize_status ? true : false,
        manual_po_status: productInfo.customer_care.manual_po_status ? true : false,
        is_3p: productInfo.customer_care.is_3p ? true : false,
      }

      console.log("-----------Inserting PO::", obj);

      await ProductionOrderModel.create(obj);

      if (!batchFound) {
        let batchData = {
          id: batchId,
          batch_no: req.body.batchNo.toUpperCase(),
          po_id: poId,
          mfg_date: new Date(req.body.mfgDate),
          exp_date: new Date(req.body.expDate),
          mrp: mrp,
          product_id: req.body.productId,
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
          skip_aggregation: productInfo.skip_aggregation,
          location_id: locationInfo.id,
          product_label: productInfo.product_label,
          product_leaflet: productInfo.product_leaflet,
          main_image: productInfo.main_image,
          is_third_party: req.body.isThirdParty,
        }

        let factorInfo = await commonController.calculateMFactor(batchData)
        batchData.p_factor = factorInfo.pFactor
        batchData.s_factor = factorInfo.sFactor
        batchData.t_factor = factorInfo.tFactor
        batchData.o_factor = factorInfo.oFactor
        await ProductBatchModel.create(batchData)
      }
      return res.send({ success: 1, message: "Production order added successfully!" });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  getPOCodeCounts: async (req, res) => {
    try {
      let validator = new v(req.body, {
        productId: "required",
        batchSize: "required",
        batchNo: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: "0", message: validatorError });
      }
      req.body.productId = req.body.productId[0].item_id;
      let productInfo = await ProductModel.findOne({
        where: {
          id: req.body.productId
        },
        include: [
          {
            model: CustomerCareModel,
            raw: true,
            as: 'customer_care'
          }
        ],
        raw: true,
        nest: true
      });

      if (!productInfo) {
        return res.status(200).send({ success: 0, message: "Item Not Found" })
      }

      if (req.body.batchNo.includes(' ')) {
        return res.status(200).send({ success: 0, message: "Space Not allowd in BatchNo" })
      }

      req.body.batchSize = Number(req.body.batchSize);
      req.body.batchNo = req.body.batchNo.toUpperCase().trim();
      if (req.body.batchSize <= 0) {
        return res.status(200).send({ success: 0, message: "Batch size should be greator than 0" })
      }


      let batchFound = await ProductBatchModel.findOne({
        where: {
          batch_no: req.body.batchNo.toUpperCase(),
          product_id: req.body.productId,

        },
        // attributes: ['id'],
        raw: true
      })

      let primaryCodes = 0, secondaryCodes = 0, tertiaryCodes = 0, outerCodes = 0;
      // Outer Codes
      let tenPercent = (req.body.batchSize * 0.1) > 5 ? Number(req.body.batchSize * 0.1) : 5
      // outerCodes = req.body.batchSize + tenPercent
      outerCodes = req.body.batchSize + 0;
      outerCodes = Math.round(outerCodes);
      console.log("batchFound::", batchFound);
      let packagingType = batchFound ? batchFound.packaging_type : productInfo.packaging_type;
      let masterInfo = batchFound ? batchFound : productInfo;
      console.log("packagingType::", packagingType);
      if (packagingType != 1) {   // If Packaging type is multi
        let codesCount = await CalculateNoOfCodes(masterInfo, req.body.batchSize);
        primaryCodes = Math.round(codesCount.primaryCodes);
        secondaryCodes = Math.round(codesCount.secondaryCodes);
        tertiaryCodes = Math.round(codesCount.tertiaryCodes);
      }
      let data = {
        primaryCodes,
        secondaryCodes,
        tertiaryCodes,
        outerCodes
      };
      return res.send({ success: 1, data: data });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },
  list: async (req, res) => {
    try {
      let validator = new v(req.query, {
        startDate: 'required',
        endDate: 'required'
      });

      const matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }
      let st = new Date(req.query.start);
      let e = new Date(req.query.end);
      if (st > e) {
        return res.status(200).send({ success: 0, message: 'Start date can not be greater than End date' });
      }

      let startDate = moment(req.query.startDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 00:00:00";
      let endDate = moment(req.query.endDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 23:59:59";

      let whereClause = {
        po_date: {
          [Op.between]: [startDate, endDate]
        },
      }

      if (req.locationId) {
        whereClause.location_id = req.locationId
      }

      let data = await ProductionOrderModel.findAll({
        where: whereClause,
        include: [
          {
            model: ProductModel,
            raw: true,
          },
          {
            model: LocationModel,
            raw: true
          },
          {
            model: ProductBatchModel,
            raw: true,
          },
        ],
        raw: true,
        nest: true
      })
      data.forEach(element => {
        element.case_mrp = Number(element.product_batch.mrp)
      });
      return res.status(200).send({ success: 1, data: data })
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },


  listByProductId: async (req, res) => {
    try {
      let validator = new v(req.params, {
        id: 'required',
      });

      const matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let whereClause = {
        product_id: req.params.id,
        status: {
          [Op.in]: [1, 2]
        }
      }

      // If user is location based then PO of that location only to be shown
      if (req.locationId) {
        whereClause.location_id = req.locationId
      }

      let data = await ProductionOrderModel.findAll({
        where: whereClause,
        raw: true,
      })

      return res.status(200).send({ success: 1, data: data });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },

  getNextPoNumber: async (req, res) => {
    try {
      let validator = new v(req.query, {
        locationcode: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        console.log("-----", validarorError);
        return res.status(200).send({ success: 0, message: validatorError });
      }
      let locationDetails = await LocationModel.findOne({
        where: {
          unique_name: req.query.locationcode
        },
        raw: true
      });
      let poCode = "1000001";
      let lastPO = await ProductionOrderModel.findOne({
        where: {
          is_from_erp: false,
          location_id: locationDetails.id
        },
        attributes: ['po_code', 'po_number'],
        order: [["createdAt", "DESC"]],
        raw: true
      });
      console.log("last PO", lastPO);
      if (lastPO) {
        poCode = ((parseInt(lastPO.po_code, 36) + 1).toString(36)).toUpperCase();
      }
      let poNumber = 'PO' + req.query.locationcode + poCode
      return res.status(200).send({ success: 1, data: { poNumber: poNumber, poCode: poCode } })
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },

  getLocations: async (req, res) => {
    try {
      let locations = await LocationModel.findAll({
        order: [["unique_name", "ASC"]],
      });
      return res.status(200).send({ success: 1, data: locations });
    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  getDetailsById: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        let validarorError = parseValidate(validator.errors)
        return res.status(200).send({ success: "0", message: validarorError });
      }

      let location_detail = await LocationModel.findOne({
        where: {
          is_deleted: false,
          id: req.query.id,
        },
        include: [
          {
            model: CityModel,
            attributes: ["id", "name"],
          },
          {
            model: StateModel,
            attributes: ["id", "name"],
          },
        ],
      });

      return res.send({ success: 1, data: location_detail });
    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  update: async (req, res) => {
    try {
      let validator = new v(req.body, {
        name: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: "0", message: validator.errors });
      }
      let updateValue = { name: req.body.name }
      let query = { where: { id: req.params.id } }

      await LocationModel.update(updateValue, query);

      return res.send({ success: 1 });
    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },


  getProductionInfo: async (req, res) => {
    try {
      let validator = new v(req.params, {
        id: 'required',
      });

      const matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let prouctionOrderInfo = await ProductionOrderModel.findOne({
        where: {
          id: req.params.id
        },
        include: [
          {
            model: ProductModel,
            raw: true,
            attributes: ['id', 'sku', 'is_tertiary', 'is_secondary', 'name']
          }
        ],
        raw: true,
        nest: true
      })

      if (!prouctionOrderInfo) {
        return res.status(200).send({ success: 0, message: "Production Order Not Found" })
      }

      let primaryParents = []
      let secondaryParents = []
      let tertiaryParents = []
      let outerParents = []

      primaryParents = await PrimaryQrCodeParent.findAll({
        where: {
          po_id: req.params.id
        },
        raw: true,
        attributes: ['id', 'total_qrcode', 'createdAt']
      })

      primaryParents.forEach(element => {
        element.type = 'Primary'
      });

      secondaryParents = await SecondaryQrCodeParent.findAll({
        where: {
          po_id: req.params.id
        },
        raw: true,
        attributes: ['id', 'total_qrcode', 'createdAt']
      })

      secondaryParents.forEach(element => {
        element.type = 'Secondary'
      });


      tertiaryParents = await TertiaryQrCodeParent.findAll({
        where: {
          po_id: req.params.id
        },
        raw: true,
        attributes: ['id', 'total_qrcode', 'createdAt']
      })

      tertiaryParents.forEach(element => {
        element.type = 'Tertiary'
      });

      outerParents = await OuterQrCodeParent.findAll({
        where: {
          po_id: req.params.id
        },
        raw: true,
        attributes: ['id', 'total_qrcode', 'createdAt']
      })

      outerParents.forEach(element => {
        element.type = 'Outer'
      });

      let allProductionData = [...primaryParents, ...secondaryParents, ...tertiaryParents, ...outerParents];

      allProductionData.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));


      // total production of outers only
      prouctionOrderInfo.totalProduction = outerParents.reduce((a, b) => +a + +b.total_qrcode, 0);

      // Mapped count of outers only
      let mappingTransactions = await MappingTransactionModel.findAll({
        where: {
          po_id: req.params.id,
          packaging_level: 'O'
        },
        raw: true,
      })

      prouctionOrderInfo.totalMapped = mappingTransactions.reduce((a, b) => a + (b['mapped_count'] || 0), 0)

      // Check any pending mapping transaction
      let pendingTransaction = await MappingTransactionModel.findOne({
        where: {
          po_id: req.params.id,
          status: {
            [Op.in]: [0, 1]
          }
        },
        raw: true
      })
      prouctionOrderInfo.disableCompletePO = false
      if (pendingTransaction || prouctionOrderInfo.status == 3) {
        prouctionOrderInfo.disableCompletePO = true
      }
      return res.status(200).send({ success: 1, orderInfo: prouctionOrderInfo, data: allProductionData })
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },

  getMappingInfo: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: 'required',
        packagingLevel: "required"
      });

      const matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let prouctionOrderInfo = await ProductionOrderModel.findOne({
        where: {
          id: req.query.id,
        },
        include: [
          {
            model: ProductModel,
            raw: true,
            attributes: ['id', 'sku', 'is_tertiary', 'is_secondary']
          }
        ],
        raw: true,
        nest: true
      })

      if (!prouctionOrderInfo) {
        return res.status(200).send({ success: 0, message: "Production Order Not Found" })
      }

      let mappingTransactions = await MappingTransactionModel.findAll({
        where: {
          po_id: req.query.id,
          packaging_level: req.query.packagingLevel
        },
        include: [
          {
            model: CompanyUsers,
            raw: true,
            attributes: ['name']
          },
          {
            model: Devices,
            attributes: ['u_id', 'asset_id'],
            raw: true
          }
        ],
        order: [['createdAt', 'ASC']],
        raw: true,
        nest: true
      })

      let child = '';
      if (mappingTransactions.length > 0) {
        switch (mappingTransactions[0].inner_level) {
          case 'P':
            child = 'Primary'
            break;
          case 'S':
            child = 'Secondary'
            break;
          case 'T':
            child = 'Tertiary'
            break;
          default:
            child = ''
            break;
        }
      }

      let info = {
        child: child,
        // totalMapped: mappingTransactions.reduce((a, b) => a + (b['mapped_count'] || 0), 0)
      }
      return res.status(200).send({ success: 1, orderInfo: info, data: mappingTransactions })
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },

  completePO: async (req, res) => {
    try {
      let validator = new v(req.body, {
        id: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: "0", message: validatorError });
      }

      let prouctionOrderInfo = await ProductionOrderModel.findOne({
        where: {
          id: req.body.id
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
          }
        ],
        raw: true,
        nest: true
      })

      if (!prouctionOrderInfo) {
        return res.status(200).send({ success: 0, message: "Production Order Not Found" })
      }

      console.log("Production Order Info::", prouctionOrderInfo);
      // Check any pending mapping transaction
      let pendingTransaction = await MappingTransactionModel.findOne({
        where: {
          po_id: req.body.id,
          status: {
            [Op.in]: [0, 1]
          }
        },
        raw: true
      })
      if (pendingTransaction) {
        return res.status(200).send({ success: 0, message: "Please submit ongoing transactions" })
      }

      let allPendingERPTransactions = await MappingTransactionModel.findAll({
        where: {
          po_id: req.body.id,
          erp_sync_status: {
            [Op.in]: [0, 2]
          },
          packaging_level: 'O',
          mapped_count: {
            [Op.gt]: 0
          }
        },
        raw: true,
        nest: true
      })

      let failedCount = 0;

      for (let element of allPendingERPTransactions) {
        let erpObj = {
          inventLocationId: prouctionOrderInfo.location.unique_name,
          samProdId: prouctionOrderInfo.po_number,
          itemId: prouctionOrderInfo.product.sku,
          qty: element.mapped_count,
          finalLot: 0,
          inventBatchId: prouctionOrderInfo.batch_no,
          rafTransfId: element.transaction_id
        }

        console.log(erpObj);

        let erpResponse = await erpConTroller.sendOnCompletePO({ _keys: [erpObj] });

        console.log(erpResponse);
        let sentToERP = erpResponse.success == 1 ? true : false;

        if (!sentToERP) {
          failedCount++;
        }
        console.log("--------Sent To ERP", sentToERP);

        await MappingTransactionModel.update({
          erp_sync_status: sentToERP ? 1 : 2,   // 1 :Successfull, 2:Failed
          erp_sync_at: sentToERP ? new Date() : null
        }, {
          where: {
            id: element.id
          }
        })
      }

      console.log("Failed Count::", failedCount);
      if (failedCount == 0) {

        // Send FInal 0 Transaction on Completion
        let erpObj = {
          inventLocationId: prouctionOrderInfo.location.unique_name,
          samProdId: prouctionOrderInfo.po_number,
          itemId: prouctionOrderInfo.product.sku,
          qty: 0,
          finalLot: 1,
          inventBatchId: prouctionOrderInfo.batch_no,
          rafTransfId: `T${prouctionOrderInfo.po_number}`
        }

        console.log(erpObj);

        let erpResponse = await erpConTroller.sendOnCompletePO({ _keys: [erpObj] });

        let finalLotSent = erpResponse.success == 1 ? true : false;

        if (!finalLotSent) {
          return res.status(200).send({ success: 0, message: "Error In sending Final Lot" })
        }

        await ProductionOrderModel.update({
          status: 3
        }, {
          where: {
            id: req.body.id
          }
        })
        return res.send({ success: 1, message: "PO Completed successfully!" });
      } else {
        return res.send({ success: 0, message: "PO Completion Failed Some ERP Sync Failed!" });
      }

    } catch (error) {
      console.log(error.message);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  listByProductIdForReport: async (req, res) => {
    try {
      let validator = new v(req.params, {
        id: 'required',
      });

      const matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let whereClause = {
        product_id: req.params.id,
        // status: {
        //   [Op.in]: [1, 2]
        // }
      }

      // If user is location based then PO of that location only to be shown
      if (req.locationId) {
        whereClause.location_id = req.locationId
      }

      let data = await ProductionOrderModel.findAll({
        where: whereClause,
        raw: true,
      })

      return res.status(200).send({ success: 1, data: data });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },

  getPoNumberList: async (req, res) => {
    try {
      let validator = new v(req.query, {
        itemId: 'required',
      });

      const matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let prouctionOrderInfo = await ProductionOrderModel.findAll({
        where: {
          product_id: req.query.itemId,
        },
        attributes: ['id', 'po_number', 'batch_no', 'product_id', 'primary_codes', 'secondary_codes', 'tertiary_codes', 'outer_codes', 'batch_id', 'location_id'],
        raw: true,
        nest: true
      })

      if (!prouctionOrderInfo) {
        return res.status(200).send({ success: 0, message: "Production Order Not Found" })
      }
      return res.status(200).send({ success: 1, data: prouctionOrderInfo })
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  }
};
async function createSummaryTable(tableName, partitionExp) {
  try {
    const env = process.env.APP_ENV || "development";

    let config = null;

    if (env == "development") config = require(path.resolve(global.rootPath + "/config/config.json"))[env];
    else config = require(path.resolve(global.rootPath + "/config/prod-config.json"))[env];

    const client = new Client({
      user: config.username,
      host: config.host,
      database: config.database,
      password: config.password,
      port: 5432,
    });
    await client.connect();

    let query = `CREATE TABLE public.${tableName} PARTITION OF public.stock_summary FOR VALUES IN('${partitionExp}')`;
    console.log("Query: ", query);
    await client.query(query);

    await client.end();

    console.log("New Summary Table Has Created");
  } catch (error) {
    console.log("error in table creation ", error.message);
  }
}

async function CalculateNoOfCodes(masterInfo, batchSize) {
  let pCodes = 0, sCodes = 0, tCodes = 0;
  let pTenPercent = 0, sTenPercent = 0, tTenPercent = 0;
  if (masterInfo.is_tertiary) {  // PSTO
    if (masterInfo.is_secondary) {
      // Tertiary Codes
      tCodes = batchSize * Number(masterInfo.outer_size);
      //Secondary Codes:
      sCodes = batchSize * Number(masterInfo.outer_size) * Number(masterInfo.tertiary_size);
      // Primary Codes
      pCodes = batchSize * Number(masterInfo.outer_size) * Number(masterInfo.tertiary_size) * Number(masterInfo.secondary_size);
    }
  }
  else if (masterInfo.is_secondary) {
    if (!masterInfo.is_tertiary) {
      //Secondary Codes:
      sCodes = batchSize * Number(masterInfo.outer_size);
      // Primary Codes
      pCodes = batchSize * Number(masterInfo.outer_size) * Number(masterInfo.secondary_size);
    }
  }
  else if (!masterInfo.is_secondary && !masterInfo.is_tertiary) {
    // Primary Codes
    pCodes = batchSize * Number(masterInfo.outer_size);
  }

  if (pCodes > 0) {
    pTenPercent = (pCodes * 0.1) > 5 ? Number(pCodes * 0.1) : 5;
  }
  if (sCodes > 0) {
    sTenPercent = (sCodes * 0.1) > 5 ? Number(sCodes * 0.1) : 5;
  }
  if (tCodes > 0) {
    tTenPercent = (tCodes * 0.1) > 5 ? Number(tCodes * 0.1) : 5;
  }

  return {
    // primaryCodes: pCodes + pTenPercent,
    // secondaryCodes: sCodes + sTenPercent,
    // tertiaryCodes: tCodes + tTenPercent
    primaryCodes: pCodes + 0,
    secondaryCodes: sCodes + 0,
    tertiaryCodes: tCodes + 0
  }

}




function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}