//models 
const models = require("./_models");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
//------------------------------sync Models--------------------------------------
//products
const syncProducts = async (req, res) => {
  try {
    let whereClause = { esign_status: 2 };
    const xHoursBeforeLocalLastSync = new Date(req.localLastSyncAt);
    xHoursBeforeLocalLastSync.setHours(xHoursBeforeLocalLastSync.getHours() - (30 * 24));//15 days
    let fromLastSync = {
      [Op.or]: {
        createdAt: { [Op.gte]: xHoursBeforeLocalLastSync },
        updatedAt: { [Op.gte]: xHoursBeforeLocalLastSync }
      }
    }

    if (req.localLastSyncAt) {
      whereClause = { ...whereClause, ...fromLastSync };
    }

    if (global.config.isProductLocationBased) {
      whereClause.location_id = req.locationId;

    }
    let products = await models.productsModel.findAll({
      where: whereClause,
      raw: true
    });
    if (products.length == 0) {
      return res.status(200).send({ success: 0, data: [], message: "No Product Found!" });
    }
    return res.status(200).send({ success: 1, data: products, message: `Total - ${products.length} Product Updated` });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError, error });
  }
};

//Batches
const syncBatches = async (req, res) => {
  try {
    let whereClause = {};
    const xHoursBeforeLocalLastSync = new Date(req.localLastSyncAt);
    xHoursBeforeLocalLastSync.setHours(xHoursBeforeLocalLastSync.getHours() - (30 * 24));//15 days
    let fromLastSync = {
      [Op.or]: {
        createdAt: { [Op.gte]: xHoursBeforeLocalLastSync },
        updatedAt: { [Op.gte]: xHoursBeforeLocalLastSync }
      }
    }

    if (req.localLastSyncAt) {
      whereClause = { ...whereClause, ...fromLastSync };
    }

    if (global.config.isProductLocationBased) {
      whereClause.location_id = req.locationId;
    }
    let Batches = await models.ProductBatchModel.findAll({
      where: whereClause,
      raw: true
    });
    if (Batches.length == 0) {
      return res.status(200).send({ success: 0, data: [], message: "No Batch Found!" });
    }
    return res.status(200).send({ success: 1, data: Batches, message: `Total - ${Batches.length} Batches Updated` });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError, error });
  }
};
//Categories
const syncCategories = async (req, res) => {
  try {
    let categories = await models.categoryModel.findAll({
      where: {},
      raw: true
    });
    return res.status(200).send({ success: 1, data: categories });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError, error });
  }
};

//Users
const syncUsers = async (req, res) => {
  try {
    let locationId = req.locationId;
    let whereClause = { location_id: locationId };

    const xHoursBeforeLocalLastSync = new Date(req.localLastSyncAt);
    xHoursBeforeLocalLastSync.setHours(xHoursBeforeLocalLastSync.getHours() - (30 * 24));//15 days
    let fromLastSync = {
      [Op.or]: {
        createdAt: { [Op.gte]: xHoursBeforeLocalLastSync },
        updatedAt: { [Op.gte]: xHoursBeforeLocalLastSync }
      }
    }

    if (req.localLastSyncAt) {
      whereClause = { ...whereClause, ...fromLastSync };
    }

    console.log(">>>>>>>>>>>>location ID",);
    let users = await models.CompanyUserModel.findAll({ where: whereClause, raw: true });
    if (users.length == 0) {
      return res.status(200).send({ success: 0, data: [] });
    }
    return res.status(200).send({ success: 1, data: users });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError, error });
  }
};

//Devices
const syncDevices = async (req, res) => {
  try {
    let locationId = req.locationId;
    let whereClause = { location_id: locationId };

    const xHoursBeforeLocalLastSync = new Date(req.localLastSyncAt);
    xHoursBeforeLocalLastSync.setHours(xHoursBeforeLocalLastSync.getHours() - (30 * 24));//15 days
    let fromLastSync = {
      [Op.or]: {
        createdAt: { [Op.gte]: xHoursBeforeLocalLastSync },
        updatedAt: { [Op.gte]: xHoursBeforeLocalLastSync }
      }
    }

    if (req.localLastSyncAt) {
      whereClause = { ...whereClause, ...fromLastSync };
    }
    let devices = await models.devicesModel.findAll({ where: whereClause, raw: true });
    if (devices.length == 0) {
      return res.status(200).send({ success: 0, data: [] });
    }
    return res.status(200).send({ success: 1, data: devices });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError, error });
  }
};

//locations 
const syncLocations = async (req, res) => {
  try {
    let locationId = req.locationId;
    let location = await models.locationModel.findAll({ where: { id: locationId }, raw: true });
    if (location.length == 0) {
      return res.status(200).send({ success: 0, data: [] });
    }
    return res.status(200).send({ success: 1, data: location });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError, error });
  }
};

//locations 
const syncStorageBins = async (req, res) => {
  try {
    let locationId = req.locationId;
    let storagebinsList = await models.storageBinsModel.findAll({ where: { location_id: locationId }, raw: true });
    if (storagebinsList.length == 0) {
      return res.status(200).send({ success: 0, data: [] });
    }
    return res.status(200).send({ success: 1, data: storagebinsList });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError, error });
  }
};

//sync only Location details from where server get requrest
const syncFactoryServer = async (req, res) => {
  try {
    let locationId = req.locationId;
    let location = await models.locationModel.findOne({ where: { id: locationId }, raw: true });
    let serverDetails = await models.systemAccessModel.findOne({ where: { location_id: locationId, u_id: req.query.mId }, raw: true });
    if (!serverDetails) {
      return res.status(200).send({ success: 0, data: [] });
    }
    let server = serverDetails;
    server.name = location.name;
    server.address = location.address;
    return res.status(200).send({ success: 1, data: [server] });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError, error });
  }
};

//Dynamic Uids
const synDynamicUids = async (req, res) => {
  try {
    console.log(">req.locationId", req.locationId);
    let whereClause = {};

    const xHoursBeforeLocalLastSync = new Date(req.localLastSyncAt);
    xHoursBeforeLocalLastSync.setHours(xHoursBeforeLocalLastSync.getHours() - (30 * 24));//30 days
    let fromLastSync = {
      [Op.or]: {
        createdAt: { [Op.gte]: xHoursBeforeLocalLastSync },
        updatedAt: { [Op.gte]: xHoursBeforeLocalLastSync }
      }
    }

    if (req.localLastSyncAt) {
      whereClause = { ...whereClause, ...fromLastSync };
    }
    let data = await models.dynaminUidsModel.findAll({
      where: whereClause,
      raw: true
    });
    if (data.length == 0) {
      return res.status(200).send({ success: 0, data: [] });
    }
    return res.status(200).send({ success: 1, data: data });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError, error });
  }
};

//production orders
const syncProdutionOrders = async (req, res) => {
  try {
    console.log(">req.locationId", req.locationId);
    let data = await models.productionOrdersModel.findAll({
      where: {
        is_sync: false,
        location_id: req.locationId
      },
      raw: true
    });
    if (data.length == 0) {
      return res.status(200).send({ success: 0, data: [] });
    }

    let POIds = data.map(itm => {
      return itm.id
    })

    for (const itm of data) {
      POIds.push(itm.id);
      delete itm.createdAt
      delete itm.updatedAt
    }

    await models.productionOrdersModel.update({
      is_sync: true
    }, {
      where: {
        id: {
          [Op.in]: POIds
        }
      }
    });
    return res.status(200).send({ success: 1, data: data });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError, error });
  }
};

const syncCodeParents = async (req, res) => {
  try {
    let primaryParents = await models.primaryQrcodeParentModel.findAll({ where: { is_sync: false, location_id: req.locationId }, raw: true });
    let sencondaryParents = await models.secondaryQrcodeParentModel.findAll({ where: { is_sync: false, location_id: req.locationId }, raw: true });
    let tertiaryParents = await models.tertiaryQrcodeParentsModel.findAll({ where: { is_sync: false, location_id: req.locationId }, raw: true });
    let outerParents = await models.outerQrcodeParentModel.findAll({ where: { is_sync: false, location_id: req.locationId }, raw: true });

    if (primaryParents.length > 0) {
      primaryParents = primaryParents.map(x => {
        return { ...x, level: 'P' }
      })
      await models.primaryQrcodeParentModel.update({
        is_sync: true
      }, {
        where: {
          id: {
            [Op.in]: primaryParents.map(x => x.id)
          }
        }
      });
    }
    if (sencondaryParents.length > 0) {
      sencondaryParents = sencondaryParents.map(x => {
        return { ...x, level: 'S' }
      })
      await models.secondaryQrcodeParentModel.update({
        is_sync: true
      }, {
        where: {
          id: {
            [Op.in]: sencondaryParents.map(x => x.id)
          }
        }
      });
    }
    if (tertiaryParents.length > 0) {
      tertiaryParents = tertiaryParents.map(x => {
        return { ...x, level: 'T' }
      })
      await models.tertiaryQrcodeParentsModel.update({
        is_sync: true
      }, {
        where: {
          id: {
            [Op.in]: tertiaryParents.map(x => x.id)
          }
        }
      });
    }
    if (outerParents.length > 0) {
      outerParents = outerParents.map(x => {
        return { ...x, level: 'O' }
      })
      await models.outerQrcodeParentModel.update({
        is_sync: true
      }, {
        where: {
          id: {
            [Op.in]: outerParents.map(x => x.id)
          }
        }
      });
    }
    return res.status(200).send({
      success: 1,
      data: [
        ...primaryParents,
        ...sencondaryParents,
        ...tertiaryParents,
        ...outerParents
      ]
    });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError, error });
  }
};

const lastSyncUpdate = async (req, res) => {
  try {
    await models.systemAccessModel.update({
      local_last_sync_at: new Date()
    }, {
      where: {
        id: req.deviceId
      }
    });

    return res.status(200).send({
      success: 1,
      message: `Last Sync At : ${new Date()}`
    });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError });
  }
}
//------------------------------ End sync Models --------------------------------

//------------------------------ New All Sync In One Function -------------------
const LocalOneSync = async (req, res) => {
  try {
    let Days = 30;
    let syncDetails = {
      systemAccess: {},
      products: {},
      batches: {},
      users: {},
      location: {},
      devices: {},
      storagebins: {},
      productionOrders: {},
      checkUids: {},
      qrCodeParents: {},
      categories: {},
      marketedBy: {}
    };
    let whereClause = { esign_status: 2 };
    const xHoursBeforeLocalLastSync = new Date(req.localLastSyncAt);
    xHoursBeforeLocalLastSync.setHours(xHoursBeforeLocalLastSync.getHours() - (Days * 24));//30 days
    let fromLastSync = {
      [Op.or]: {
        createdAt: { [Op.gte]: xHoursBeforeLocalLastSync },
        updatedAt: { [Op.gte]: xHoursBeforeLocalLastSync }
      }
    }
    syncDetails.systemAccess = await FactoryServer(fromLastSync, req.localLastSyncAt, req.locationId, req.mId);
    if (syncDetails.systemAccess.success == 0) {
      return res.status(200).send({ success: 0, data: syncDetails, message: "Server Detail Not found" });
    }
    syncDetails.products = await products(fromLastSync, req.localLastSyncAt, req.locationId);
    syncDetails.batches = await batches(fromLastSync, req.localLastSyncAt, req.locationId);
    syncDetails.location = await locations(fromLastSync, req.localLastSyncAt, req.locationId);

    await models.systemAccessModel.update({ local_last_sync_at: new Date() }, {
      where: {
        id: req.deviceId
      }
    });
    return res.status(200).send({ success: 1, data: syncDetails, message: "Success" });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError });
  }
};

//------------------------------Sub Function For One Sync -----------------------

//sync only Location details from where server get requrest
async function FactoryServer(fromLastSync, localLastSyncAt, locationId, mid) {
  try {
    let location = await models.locationModel.findOne({ where: { id: locationId }, raw: true });
    let serverDetails = await models.systemAccessModel.findOne({ where: { location_id: locationId, u_id: mid }, raw: true });
    if (!serverDetails) {
      return { success: 0, data: [], message: `No server Details Found` };
    }
    let server = serverDetails;
    server.name = location.name;
    server.address = location.address;
    return { success: 1, data: [server], message: `server (MID:: ${mid}) Details Found` };
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return { success: 0, data: [], message: models.message.internalError };
  }
};

async function products(fromLastSync, localLastSyncAt, locationId) {
  try {
    let whereClause = { esign_status: 2 };

    if (localLastSyncAt) {
      whereClause = { ...whereClause, ...fromLastSync };
    }

    if (global.config.isProductLocationBased) {
      whereClause.location_id = locationId;

    }
    let products = await models.productsModel.findAll({
      where: whereClause,
      raw: true
    });
    if (products.length == 0) {
      return { success: 1, data: [], message: `products [0] Sync Success` };
    }
    return { success: 1, data: products, message: `products [${products.length}] Sync Success` };
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return { success: 0, data: [], message: models.message.internalError };
  }
}

async function batches(fromLastSync, localLastSyncAt, locationId) {
  try {
    let whereClause = {};
    if (localLastSyncAt) {
      whereClause = { ...whereClause, ...fromLastSync };
    }

    if (global.config.isProductLocationBased) {
      whereClause.location_id = locationId;
    }
    let Batches = await models.ProductBatchModel.findAll({
      where: whereClause,
      raw: true
    });
    if (Batches.length == 0) {
      return ({ success: 1, data: [], message: `batches [0] Sync Success` });
    }
    return { success: 1, data: Batches, message: `batches [${Batches.length}]  Sync Success` };
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return { success: 0, data: [], message: models.message.internalError };
  }
}

async function locations(fromLastSync, localLastSyncAt, locationId) {
  try {
    let location = await models.locationModel.findAll({ where: { id: locationId }, raw: true });
    if (location.length == 0) {
      return { success: 1, data: [], message: `Location Not found` };
    }
    return { success: 1, data: location, message: `Location [${location.name}]  Sync Success` };
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError });
  }
}

async function users(fromLastSync, localLastSyncAt, locationId) {
  try {
    let whereClause = { location_id: locationId };
    const xHoursBeforeLocalLastSync = new Date(req.localLastSyncAt);
    xHoursBeforeLocalLastSync.setHours(xHoursBeforeLocalLastSync.getHours() - (30 * 24));//15 days
    let fromLastSync = {
      [Op.or]: {
        createdAt: { [Op.gte]: xHoursBeforeLocalLastSync },
        updatedAt: { [Op.gte]: xHoursBeforeLocalLastSync }
      }
    }

    // if (req.localLastSyncAt) {
    //   whereClause = { ...whereClause, ...fromLastSync };
    // }

    console.log(">>>>>>>>>>>>location ID",);
    let users = await models.CompanyUserModel.findAll({ where: whereClause, raw: true });
    if (users.length == 0) {
      return res.status(200).send({ success: 0, data: [] });
    }
    return res.status(200).send({ success: 1, data: users });
  }
  catch (error) {
    models.logger.error(req, error.message);
    console.log("Error", error);
    return res.status(500).send({ success: 0, message: models.message.internalError, error });
  }
}
//--------------------------End one sync---------------------

module.exports = {
  syncProducts,
  syncBatches,
  syncUsers,
  syncDevices,
  syncLocations,
  syncStorageBins,
  syncFactoryServer,
  synDynamicUids,
  syncCodeParents,
  syncProdutionOrders,
  syncCategories,
  lastSyncUpdate,
  LocalOneSync
}