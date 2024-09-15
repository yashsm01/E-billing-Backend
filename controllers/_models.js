//constants
const env = process.env.APP_ENV || 'dev';
const config = require(`${__dirname}/../config/${env}-config.json`);
const message = require("../i18n/en");
//helpers
const logger = require("../helpers/logger");

//models
const indexModel = require('./../models/index');
const districtModel = require("../models/").districts;
const taluksModel = require("../models/").taluks;
const cityModel = require("../models/").city;
const pincodeModel = require("../models/").pincodes;
const companiesModel = require("../models/").companies;
const companyRoleModel = require("../models/").company_roles;
const CompanyUserModel = require("../models/").company_users;
const controlPanelModel = require("../models/").control_panel;
const countriesModel = require("../models/").countries;
const customerCareModel = require("../models/").customer_care;
const devicesModel = require("../models/").devices;
const dynamicLevelModel = require("../models/").dynamic_level_codes;
const dynamicModel = require("../models/dynamic_models");
const dynaminUidsModel = require("../models/").dynamic_uids;
const locationModel = require("../models/").locations;
const mappingTransactionModel = require("../models/").mapping_transactions;
const scanningTransactionModel = require("../models/").scanning_transactions;

const transactionChildModel = require("../models/").transaction_child;
const notficationModel = require("../models/").notifications;
const outerQrcodeParentModel = require("../models/").outer_qrcode_parents;
const primaryQrcodeParentModel = require("../models/").primary_qrcode_parents;
const ProductBatchModel = require("../models/").product_batches;
const productionOrdersModel = require("../models/").production_orders;
const productsModel = require("../models/").products;
const qrcodeAllocationHistoryModel = require("../models/").qrcode_allocation_history;
const qrcodeBankModel = require("../models/").qrcodes_bank;
const replacementHistoryModel = require("../models/").replacement_history;
const secondaryQrcodeParentModel = require("../models/").secondary_qrcode_parents;
const stateModel = require("../models/").state;
const stockSummaryModel = require("../models/").stock_summary;
const storageBinsModel = require("../models/").storage_bins;
const tertiaryQrcodeParentsModel = require("../models/").tertiary_qrcode_parents;
const transactionScannedInfoModel = require("../models/").transaction_scanned_info;
const syncDetailsModel = require("../models/").sync_details;
const systemAccessModel = require("../models/").system_access;
const productRangeModel = require("../models/").product_range;
const productGroupModel = require("../models/").product_group;
const categoryModel = require("../models/").categories;
const uomModel = require("../models/").uom;
const OrderModel = require("../models/").orders;
const ChannelPartners = require("../models/").channel_partners;

//upload Models
const batchRequestModel = require("../models/").batch_upload_request;
const batchChildRequestModel = require("../models/").batch_upload_child_request;

const AdjustmentModel = require("../models/").adjustments;
const AdjustmentCodeModel = require("../models/").adjustments_codes;

const pointAllocationModel = require("../models/").point_allocation;

const LuckyDrawModel = require("../models").lucky_draws;
const LuckyDrawHistoryModel = require("../models").luckydraw_history;
const scratchCardModel = require("../models/").scratch_cards;

const zoneMasterModel = require("../models").zone_master;
const zoneHistoryMasterModels = require("../models").zone_history_master;
const zoneChildMasterModel = require("../models/").zone_child_master;
const parentZoneMasterModel = require("../models").parent_zone_master;
const parentZoneHistoryMasterModels = require("../models/").parent_zone_history_master;

const territoryMasterModel = require("../models/").terriotory_master;
const territoryHistoryMasterModel = require("../models/").territory_master_history;

const pointsValuationModel = require("../models/").points_valuation;
const pointsDistributionModel = require("../models/").points_distribution;

const CounterfitModel = require("../models/").counterfit;

//E-belling Models
const retailerOutletsModels = require("../models/").retailer_outlets;
const plansModel = require("../models/").plans;
const featuresModel = require("../models/").features;
const RetailerModel = require("../models/").retailers;
const retailCustomerModel = require("../models/").reatil_Customers;
const ConsumersModel = require("../models/").consumers;
const doctorsModel = require("../models").doctors;
const DistributorsModel = require("../models/").distributors;
const BankDetailsModel = require("../models/").bank_details;

//Dynamic tables 
const purchaseOrderDetailModel =

  module.exports = {
    //constants
    config,//DB Configuration
    message,//static messages

    //helpers
    logger,

    //models
    indexModel,
    districtModel,
    taluksModel,
    cityModel,
    pincodeModel,
    companiesModel,
    companyRoleModel,
    CompanyUserModel,
    controlPanelModel,
    countriesModel,
    customerCareModel,
    devicesModel,
    dynamicLevelModel,
    dynamicModel,
    dynaminUidsModel,
    locationModel,
    mappingTransactionModel,
    scanningTransactionModel,
    transactionChildModel,
    notficationModel,
    outerQrcodeParentModel,
    primaryQrcodeParentModel,
    ProductBatchModel,
    productionOrdersModel,
    productsModel,
    qrcodeAllocationHistoryModel,
    qrcodeBankModel,
    replacementHistoryModel,
    secondaryQrcodeParentModel,
    stateModel,
    stockSummaryModel,
    storageBinsModel,
    tertiaryQrcodeParentsModel,
    transactionScannedInfoModel,
    syncDetailsModel,
    systemAccessModel,
    productRangeModel,
    productGroupModel,
    categoryModel,
    uomModel,
    batchRequestModel,
    batchChildRequestModel,
    OrderModel,
    AdjustmentModel,
    AdjustmentCodeModel,
    pointAllocationModel,
    LuckyDrawModel,
    LuckyDrawHistoryModel,
    scratchCardModel,
    zoneMasterModel,
    zoneHistoryMasterModels,
    zoneChildMasterModel,
    parentZoneMasterModel,
    parentZoneHistoryMasterModels,
    territoryMasterModel,
    territoryHistoryMasterModel,
    ChannelPartners,
    pointsValuationModel,
    pointsDistributionModel,
    CounterfitModel,

    //e-billing 
    //=====Dynamic========
    productSchema,
    puchaseSchema,
    stockSchema,
    salesSchema,
    retailerBatchSchema,
    distributorSchema,
    customerSchema,
    //====================
    retailerOutletsModels,
    plansModel,
    featuresModel,
    RetailerModel,
    ConsumersModel,
    doctorsModel,
    retailCustomerModel,
    DistributorsModel,
    BankDetailsModel,
  };


//================================= dynamic models association function================
async function productSchema(uid = false, sync = false) {
  if (!uid) {
    return;
  }
  let ProductModals = productsModel;
  let productStockModels = await dynamicModel.getProductStockModel(uid, sync);
  let batchStockModels = await dynamicModel.getBatchStockModel(uid, sync);
  if (!ProductModals.associations['product_stocks']) {
    ProductModals.hasOne(productStockModels, {
      foreignKey: 'product_id',
      sourceKey: 'id',
      as: "product_stocks"
    });
  }
  if (!ProductModals.associations['batch_stocks']) {
    ProductModals.hasOne(batchStockModels, {
      foreignKey: 'batch_id',
      sourceKey: 'id',
      as: "batch_stocks"
    });
  }
  return { ProductModals, productStockModels, batchStockModels };
}

async function puchaseSchema(uid = false, sync = false) {
  if (!uid) {
    return;
  }
  let purchaseOrderModels = await dynamicModel.getPurchaseOrderModel(uid, sync);
  let purchaseOrderDetailModels = await dynamicModel.getPurchaseOrderDetailsModel(uid, sync);
  let retailBatchModels = await dynamicModel.getRetailerBatchModel(uid, sync);
  let retailDistributorModels = await dynamicModel.getRetailDistributorMasterModel(uid, sync);
  let batchStockModels = await dynamicModel.getBatchStockModel(uid, sync);
  let bankDetailsModel = await dynamicModel.getBankDetailsModel(uid, sync);

  purchaseOrderDetailModels.hasOne(purchaseOrderModels, {
    foreignKey: 'id',
    sourceKey: 'po_id',
    as: "purchase_order"
  });
  purchaseOrderDetailModels.hasOne(retailBatchModels, {
    foreignKey: 'id',
    sourceKey: 'batch_id',
    as: "product_batches"
  });
  purchaseOrderModels.hasOne(retailDistributorModels, {
    foreignKey: 'distributor_id',
    sourceKey: 'distributor_id',
    as: "retail_distributor",
  });
  if (!retailBatchModels.associations['batchStock']) {
    retailBatchModels.hasOne(batchStockModels, {
      foreignKey: 'batch_id',
      sourceKey: 'id',
      as: "batchStock"
    });
  }
  if (!purchaseOrderModels.associations['bank_details']) {
    purchaseOrderModels.hasOne(bankDetailsModel, {
      foreignKey: 'id',
      sourceKey: 'bank_id',
      as: "bank_details"
    });
  }
  return { purchaseOrderDetailModels, purchaseOrderModels, retailBatchModels, retailDistributorModels, batchStockModels, bankDetailsModel };
}

async function stockSchema(uid = false, sync = false) {
  if (!uid) {
    return;
  }
  let productStockModels = await dynamicModel.getProductStockModel(uid, sync);
  let batchStockModels = await dynamicModel.getBatchStockModel(uid, sync);
  let retailBatchModels = await dynamicModel.getRetailerBatchModel(uid, sync);
  if (!batchStockModels.associations['product_stocks']) {
    batchStockModels.hasOne(productStockModels, {
      foreignKey: 'product_id',
      sourceKey: 'product_id',
      as: "product_stocks"
    });
  }
  if (!batchStockModels.associations['product_batches']) {
    batchStockModels.hasOne(retailBatchModels, {
      foreignKey: 'id',
      sourceKey: 'batch_id',
      as: "product_batches"
    });
  }
  if (!retailBatchModels.associations['batch_stocks']) {
    retailBatchModels.hasOne(batchStockModels, {
      foreignKey: 'batch_id',
      sourceKey: 'id',
      as: "batch_stocks"
    });
  }

  return { productStockModels, batchStockModels, retailBatchModels };
}

async function salesSchema(uid = false, sync = false) {
  if (!uid) {
    return;
  }
  let salesModels = await dynamicModel.getSalesModel(uid, sync);
  let salesDetailModels = await dynamicModel.getSalesDetailsModel(uid, sync);
  let retailBatchModels = await dynamicModel.getRetailerBatchModel(uid, sync);
  let retailCustomerMasterModels = await dynamicModel.getRetailCustomerMasterModel(uid, sync);
  let batchStockModels = await dynamicModel.getBatchStockModel(uid, sync);

  salesDetailModels.hasOne(salesModels, {
    foreignKey: 'id',
    sourceKey: 'batch_id',
    as: "sales"
  });
  salesDetailModels.hasOne(retailBatchModels, {
    foreignKey: 'id',
    sourceKey: 'batch_id',
    as: "product_batches"
  })
  salesModels.hasOne(retailCustomerMasterModels, {
    foreignKey: 'consumer_id',
    sourceKey: 'customer_id',
    as: "retail_customer",
  });
  if (!retailBatchModels.associations['batchStock']) {
    retailBatchModels.hasOne(batchStockModels, {
      foreignKey: 'batch_id',
      sourceKey: 'id',
      as: "batchStock"
    });
  }
  return { salesDetailModels, salesModels, retailBatchModels, retailCustomerMasterModels, batchStockModels };
}
async function retailerBatchSchema(uid = false, sync = false) {
  if (!uid) {
    return;
  }
  let retailBatchModels = await dynamicModel.getRetailerBatchModel(uid, sync);
  let batchStockModels = await dynamicModel.getBatchStockModel(uid, sync);
  retailBatchModels.hasOne(batchStockModels, {
    foreignKey: 'batch_id',
    sourceKey: 'id',
    as: "batchStock"
  });

  return { retailBatchModels, batchStockModels };
}

async function distributorSchema(uid = false, sync = false) {
  if (!uid) {
    return;
  }
  let distributorModels = await DistributorsModel;
  let retailDistributorModels = await dynamicModel.getRetailDistributorMasterModel(uid, sync);
  if (!DistributorsModel.associations['retail_distributor']) {
    DistributorsModel.hasOne(retailDistributorModels, {
      foreignKey: 'distributor_id',
      sourceKey: 'id',
      as: "retail_distributor",
    });
  }

  return { distributorModels, retailDistributorModels };
}

async function customerSchema(uid = false, sync = false) {
  if (!uid) {
    return;
  }
  let customerModels = await ConsumersModel;
  let retailCustomerModel = await dynamicModel.getRetailCustomerModel(uid, sync);
  let retailCustomerMasterModels = await dynamicModel.getRetailCustomerMasterModel(uid, sync);
  if (!retailCustomerModel.associations['retail_customer']) {
    retailCustomerModel.hasOne(retailCustomerMasterModels, {
      foreignKey: 'consumer_id',
      sourceKey: 'consumer_id',
      as: "retail_customer",
    });
  }

  return { customerModels, retailCustomerModel, retailCustomerMasterModels };
}




//=====================================================================================


