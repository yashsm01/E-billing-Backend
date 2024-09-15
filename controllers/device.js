const v = require("node-input-validator");
const Sequelize = require("sequelize");
const uuid = require("uuid");
const logger = require("../helpers/logger");
const DeviceModel = require("../models").devices;
const Location = require("../models/").locations;
const path = require("path");
const { Client } = require("pg");
const Op = Sequelize.Op;

DeviceModel.belongsTo(Location, {
  foreignKey: "location_id"
});

const device = {
  add: async (req, res) => {
    try {
      let validator = new v(req.body, {
        IMEI: "required",
        locationId: "required",
        assetId: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: "0", message: validator.errors });
      }

      let count1 = await DeviceModel.count({
        where: {
          asset_id: req.body.assetId,
        },
      });
      if (count1 > 0) {
        return res.status(200).send({ success: 0, message: "Asset Id Already Exists!" });
      }

      let count = await DeviceModel.count({
        where: {
          u_id: req.body.IMEI,
        },
      });
      if (count > 0) {
        return res.status(200).send({ success: 0, message: "Device is already added!" });
      }
      await DeviceModel.create({
        // id: uuid(),
        u_id: req.body.IMEI,
        location_id: req.body.locationId,
        asset_id: req.body.assetId,
        is_active: true,
        esign_status: global.config.isEsignBased ? 1 : 2,
      });
      return res.send({ success: 1, message: "Device has been added successfully!" });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },

  /**
   * @owner Kapil
   * @description get locations details
   */
  get: async (req, res) => {
    try {
      let whereClause = {};
      if ([3].includes(req.roleId)) {
        whereClause.location_id = req.locationId;
      }
      let devices = await DeviceModel.findAll({
        // order: [["unique_name", "ASC"]],
        where: whereClause,
        include: [
          {
            model: Location,
            raw: true,
            attributes: ['id', 'unique_name'],
          }
        ],
        raw: true,
        nest: true
      });
      return res.status(200).send({ success: 1, data: devices });
    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  getDetailsById: async (req, res) => {
    try {
      let validator = new v(req.params, {
        id: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: "0", message: validator.errors });
      }

      let device_detail = await DeviceModel.findOne({
        where: {
          id: req.params.id,
        }
      });

      return res.send({ success: 1, data: device_detail });
    } catch (error) {
      logger.error(error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  update: async (req, res) => {
    try {
      let validator = new v(req.body, {
        locationId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: "0", message: validator.errors });
      }

      let uniqueIdCount = await DeviceModel.count({
        where: {
          u_id: req.body.IMEI,
          asset_id: {
            [Op.ne]: req.body.assetId
          }
        }
      });

      if (uniqueIdCount > 0) {
        return res.status(200).send({ success: "0", message: 'Unique ID Already Exist' });
      }
      let updateValue = { asset_id: req.body.assetId, location_id: req.body.locationId, u_id: req.body.IMEI }
      let query = { where: { id: req.params.id } }

      await DeviceModel.update(updateValue, query);

      return res.send({ success: 1 });
    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
};
module.exports = device;
