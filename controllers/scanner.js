const RegisteredDevice = require('../models/').registered_scanner_devices;
const v = require("node-input-validator");
const logger = require('../helpers/logger');
const LocationModel = require('../models/').locations;

module.exports = {
  registerDevice: async (req, res) => {
    try {
      let validator = new v(req.body, {
        uniqueId: "required",
        locationUniqueName: "required"
      });

      let matched = await validator.check();

      if (!matched) {
        return res
          .status(200)
          .send({
            success: "0",
            message: validator.errors[Object.keys(validator.errors)[0]].message
          });
      }

      console.log('req.body.locationUniqueName: ', req.body.locationUniqueName)
      const locationInfo = await LocationModel.findOne({
        where: {
          unique_name: req.body.locationUniqueName,
          is_deleted: false
        }
      });

      if (!locationInfo) {
        return res.send({
          success: 0,
          message: "Location is not found!"
        })
      }

      const isExists = await RegisteredDevice.count({
        where: {
          unique_id: req.body.uniqueId
        }
      });

      if (isExists > 0) {
        return res.send({
          success: 0,
          message: "This scanner is already registered!"
        })
      }

      await RegisteredDevice.create({
        unique_id: req.body.uniqueId,
        location_id: locationInfo.id
      });

      return res.send({
        success: 1,
        message: "Device has been registered successfully!"
      })

    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.message
      });
    }
  },
  updateStatus: async (req, res) => {
    try {
      let validator = new v(req.body, {
        deviceId: "required",
        status: "required"
      });

      let matched = await validator.check();

      if (!matched) {
        return res
          .status(200)
          .send({
            success: "0",
            message: validator.errors[Object.keys(validator.errors)[0]].message
          });
      }

      const isExists = await RegisteredDevice.count({
        where: {
          id: req.body.deviceId
        }
      });

      if (isExists == 0) {
        return res.send({
          success: 0,
          message: "Device isn't found!"
        });
      }

      await RegisteredDevice.update({
        is_active: req.body.status
      }, {
        where: {
          id: req.body.deviceId
        }
      });

      return res.send({
        success: 1,
        message: `Device has been ${req.body.status ? 'Activated' : 'Deactivated'}!`
      })

    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.message
      });
    }
  }
}