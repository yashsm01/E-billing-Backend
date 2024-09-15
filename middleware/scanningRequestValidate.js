const Employee = require('../models/').company_users;
const userDeviceDetail = require('../models').user_device_detail;
const JWT = require('jsonwebtoken')
const RegisteredScannerDevice = require('../models/').registered_scanner_devices;

const env = process.env.APP_ENV || 'development';
let configRoot;
if (env == "development")
  configRoot = require('../config/config.json');
else
  configRoot = require('../config/prod-config.json');

module.exports = async (req, res, next) => {
  try {
    let token = req.headers['x-access-token'];

    if (token) {

      const decodedPayload = await JWT.verify(
        token,
        configRoot.jwt.mappingApp.privateKey, {
        algorithms: configRoot.jwt.mappingApp.alg
      }
      )

      const employee = await Employee.findOne({
        where: {
          id: decodedPayload.userId
        },
        raw: true,
        attributes: ['company_id', 'id', 'production_unit_id', 'location_id']
      });

      if (!employee) {
        console.log('---emp not found--');
        return res.status(401).send({
          success: 0,
          message: "Unauthorized Access!"
        });
      }

      const regDeviceInfo = await RegisteredScannerDevice.findOne({
        where: {
          id: decodedPayload.deviceId,
          location_id: employee.location_id,
          is_active: true,
          mapping_jwt_token: token
        }
      });

      if (!regDeviceInfo) {
        return res.status(401).send({ message: "This device isn't authorized!" })
      }

      console.log('employee---->', employee);

      req.headers['x-key-companyId'] = employee.company_id;
      req.headers['x-key'] = employee.id;
      req.userId = employee.id;
      req.locationId = employee.location_id;
      req.deviceId = regDeviceInfo.id
      next();
    } else {
      console.log('---else---');
      return res.status(401).send({
        success: 0,
        message: "Unauthorized Access!"
      });
    }
  } catch (ex) {
    console.error('---ex----', ex);
    return res.status(401).send({
      success: 0,
      message: "Unauthorized Access!"
    });
  }
};
