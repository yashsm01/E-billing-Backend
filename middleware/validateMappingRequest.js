const jwt = require('jsonwebtoken');

const CompanyUsers = require('../models/').company_users;
const Devices = require('../models/').devices;

module.exports = async (req, res, next) => {

  try {
    console.log("----In validate Mapping Request----");
    let token = (req.body && req.body.access_token) || (req.query && req.query.access_token) || req.headers['x-access-token'];
    // const uuidV4Regex = /^[A-F\d]{8}-[A-F\d]{4}-4[A-F\d]{3}-[89AB][A-F\d]{3}-[A-F\d]{12}$/i;
    console.log("token::", token);
    if (token) {
      let decoded = await jwt.verify(token, require('../config/secret.js')());
      console.log('decoded - ', decoded);


      let deviceInfo = await Devices.findOne({
        where: {
          id: decoded.device_id
        },
        raw: true
      })
      if (!deviceInfo) {
        console.log("-----------Invalid Device Id");
        return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
      }

      let userDetails = await CompanyUsers.findOne({
        where: {
          random_id: decoded.id,
          location_id: deviceInfo.location_id
          // jwt_token: token   // At a time one user can be logged in to multiple devices
        },
        raw: true
      });
      // console.log("userDetails", userDetails);
      if (!userDetails) {
        return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
      }
      req.userId = userDetails.id;
      req.roleId = userDetails.role_id;
      req.locationId = userDetails.location_id
      req.deviceId = deviceInfo.id;
      next();
    }
    else {
      return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
    }
  } catch (error) {
    console.log(error);
    return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
  }

};