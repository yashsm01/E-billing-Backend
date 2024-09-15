const v = require('node-input-validator');
const message = require('../../i18n/en');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const uuid = require("uuid");

const ProductBatchModel = require('../../models/').product_batches;
const logger = require('../../helpers/logger');
const parseValidate = require('../../middleware/parseValidate');
const Product = require("../../models/").products;

//models 
const models = require("../_models");
const DynamicModels = require('../../models/dynamic_models')

// controllers
const commonController = require('../../controllers/common');

const uploadCodes = {
  syncUploadCodes: async (req, res) => {
    try {
      let validator = new v(req.body, {
        batchId: "required",
        key: "required",
        ids: "required",
        BRD: "required",
        BCRD: "required",
        ProductId: "required"
      });
      let errorss;
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: 0, message: validator.errors });
      }

      let batchDetail = await models.ProductBatchModel.findOne({ where: { id: req.body.batchId }, include: [{ model: models.productsModel }], raw: true, nest: true });
      if (!batchDetail) { return res.status(200).send({ success: 0, message: "Batch Details doesn't Found" }); }

      if (batchDetail.product.id !== req.body.ProductId) {
        return res.status(200).send({ success: 0, message: "Product Details doesn't Match With available Product" });
      }
      let storageBin;
      let UID = batchDetail.product.u_id;
      let CustomSchema = await getDynamicModel(req.body.key, UID);
      let updateCount = 0;
      let insertCount = 0;
      let toInsert = [];
      let Output = [];
      for (let i = 1; i <= req.body.ids.length; i++) {
        const element = req.body.ids[i - 1];
        let data = {
          id: element.id,
          product_id: element.product_id,
          batch_id: element.batch_id,
          po_id: element.po_id,
          // qr_code: element.qr_code,
          unique_code: element.unique_code,
          // serial_code: element.serial_code,
          parent_id: element.parent_id,
          is_open: element.is_open,
          is_general: element.is_general,
          parent_level: element.parent_level,
          is_mapped: element.is_mapped,
          mapped_to_parent: element.mapped_to_parent,
          mapped_at: element.mapped_at,
          mapped_by: element.mapped_by,
          is_complete: element.is_complete,
          completed_at: element.completed_at,
          completed_by: element.completed_by,
          is_scanned: element.is_scanned,
          storage_bin_id: element.storage_bin_id,
          created_at: element.created_at,
          is_active: element.is_active,
          is_replaced: element.is_replaced,
          replaced_with: element.replaced_with,
          replaced_from: element.replaced_from,
          replaced_with_type: element.replaced_with_type,
          replaced_at: element.replaced_at,
          replaced_by: element.replaced_by,
          mapp_transaction_id: element.mapp_transaction_id,
          transaction_id: element.transaction_id,
          mapping_po_id: element.mapping_po_id,
          assigned_product_id: element.assigned_product_id,
          is_box_opened: element.is_box_opened,
          is_in_consignment: element.is_in_consignment,
          createdAt: element.createdAt,
          updatedAt: element.updatedAt,
          request_id: req.body.BRD.id,
          is_dropped: element?.is_dropped ?? false
        }
        if (i == 1) {
          storageBin = element.storage_bin_id;
        }
        if (element.is_reUpload != true) {
          toInsert.push(data);
        }
        else {
          await CustomSchema.upsert(data, { where: { id: element.id } });
          Output.push(data);
          updateCount += 1;
        }
        const isLastItem = i === req.body.ids.length;
        if (i % 1000 === 0 || isLastItem) {
          try {
            // console.log(toInsert);
            // console.log("Start bulk create ")
            let dataCreated = await CustomSchema.bulkCreate(toInsert);
            // console.log("done bulk create  ", dataCreated)
            Output.push(...toInsert);
            insertCount += toInsert.length;
          }
          catch (error) {
            errorss = error;
            console.log(error);

          }
          toInsert = [];
        }
      }


      let BCRDDetail = {
        id: uuid(),
        child_request_id: req.body.BCRD.id,
        product_id: req.body.ProductId,
        batch_id: req.body.BCRD.batch_id,
        request_id: req.body.BCRD.request_id,
        level: req.body.BCRD.level,
        inserted_counts: insertCount,
        updated_countes: updateCount,
        uploaded_codes: Output.length,
        location_id: req.locationId
      };
      // let BCRD create 
      await models.batchChildRequestModel.create(BCRDDetail);

      let BRDDetail = {
        id: req.body.BRD.id,
        batch_id: req.body.BRD.batch_id
      };
      // let BRD update 
      await models.batchRequestModel.upsert(BRDDetail, { where: { id: req.body.BRD.id, batch_id: req.body.BRD.batch_id } });
      res.status(200).send({ success: 1, message: "success", data: Output, errorss });
      if (insertCount > 0) {
        let storageBinDetails = await models.storageBinsModel.findOne({ where: { location_id: req.locationId, name: "OK" }, raw: true });
        if (storageBinDetails) {
          storageBin = storageBinDetails.id;
        }
        await commonController.addOrUpdateStockSummary(
          req.locationId, storageBin, batchDetail.product.id, req.body.BCRD.batch_id, req.body.BCRD.level, insertCount);
      }
      return;

    }
    catch (error) {
      models.logger.error(req, error.message);
      console.log("Error", error);
      return res.status(200).send({ success: 0, message: error.message });
    }
  },
};

//================================Sub Helpers================================
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
    console.log("------------", error);
  }
}

module.exports = uploadCodes;