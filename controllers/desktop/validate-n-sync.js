const v = require('node-input-validator');
const logger = require('../../helpers/logger');
const SystemAccessModel = require('../../models/').system_access;
const UserModel = require('../../models/').company_users;
const sequelize = require('sequelize');
const Op = sequelize.Op;

const ProductModel = require('../../models/').products;
const ProductBatch = require('../../models/').product_batches


const AuthController = {
  manualSync: async (req, res) => {
    try {
      let validator = new v(req.body, {
        uId: 'required'
      });

      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: 0, message: validator.errors });
      }

      let deviceInfo = await SystemAccessModel.findOne({
        where: {
          u_id: req.body.uId,
          is_active: true
        },
        raw: true
      });

      if (!deviceInfo) {
        return res.status(401).send({ success: 0, message: "Invalid Access" });
      }

      let syncInfo = await syncData(deviceInfo);
      await SystemAccessModel.update({
        last_sync_at: new Date()
      }, {
        where: {
          id: deviceInfo.id
        }
      });
      return res.send({
        success: 1,
        data: {
          systemConfig: deviceInfo,
          users: syncInfo.users,
          products: syncInfo.products,
          productBatches: syncInfo.productBatches
        }
      });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },
  validateAccess: async (req, res) => {
    try {
      let validator = new v(req.body, {
        key: 'required',
        uId: 'required'
      });

      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: 0, message: validator.errors });
      }

      let deviceInfo = await SystemAccessModel.findOne({
        where: {
          u_id: req.body.uId,
          secret_key: req.body.key,
          is_active: true
        }
      });

      if (!deviceInfo) {
        return res.send({ success: 0, message: "Invalid Access" });
      }

      return res.send({
        success: 1,
        data: {
          systemConfig: deviceInfo,
          users: [],
          products: [],
          productBatches: []
        }
      });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ "success": "0", "message": error.message });
    }
  }
};

async function syncData(deviceInfo) {
  try {

    ProductModel.hasOne(ProductBatch, { foreignKey: 'product_id' });
    ProductBatch.belongsTo(ProductModel, { foreignKey: 'product_id' });

    let userWhereClause = {
      location_id: deviceInfo.location_id,
      role_id: {
        [Op.in]: [3, 4]
      },
      is_deleted: false
    }
    let productWhereClause = {}
    let batchWhereClause = {
      [Op.or]: [
        {
          location_id: deviceInfo.location_id,
        },
        {
          batch_no: "OPEN_BATCH"
        }
      ]
    }

    const xHoursBeforeLastSync = new Date(deviceInfo.last_sync_at);
    xHoursBeforeLastSync.setHours(xHoursBeforeLastSync.getHours() - (15 * 24));//15 days

    let fromLastSync = {
      [Op.or]: {
        createdAt: { [Op.gte]: xHoursBeforeLastSync },
        updatedAt: { [Op.gte]: xHoursBeforeLastSync }
      }
    }
    if (deviceInfo.last_sync_at) {
      userWhereClause = { ...userWhereClause, ...fromLastSync };
      productWhereClause = { ...productWhereClause, ...fromLastSync };
      batchWhereClause = { ...batchWhereClause, ...fromLastSync };
    }
    if (global.config.isProductLocationBased) {
      productWhereClause.location_id = deviceInfo.location_id
    }
    console.log(">>>>>>>>>>>>>>>userWhereClause", userWhereClause);
    let users = await UserModel.findAll({
      where: userWhereClause,
      raw: true
    });
    console.log(">>>>>>>>>>>>>>>productWhereClause", productWhereClause);

    let products = await ProductModel.findAll({
      where: productWhereClause,
      raw: true
    });
    console.log(">>>>>>>>>>>>>>>batchWhereClause", batchWhereClause);

    let productBatches = await ProductBatch.findAll({
      where: batchWhereClause,
      include: [
        {
          model: ProductModel,
          attributes: ['sku', 'name']
        }],
      raw: true,
      nest: true
    })
    console.log(">>>>>>>productBatches", productBatches.length);
    console.log(">>>>>>>users", users.length);
    console.log(">>>>>>>products", products.length);
    return {
      users: users,
      products: products,
      productBatches: productBatches
    }
  } catch (error) {
    console.log(error);
    return
  }

}

module.exports = AuthController;
