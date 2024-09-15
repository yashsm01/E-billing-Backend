const JWT = require('jsonwebtoken')


const CompanyUserModel = require('../models/').company_users;
const DevicesModel = require('../models/').devices;


module.exports = async (req, res, next) => {
  try {
    let token = req.headers['x-access-token'];
    if (token) {
      let decoded = await JWT.verify(
        token,
        global.config.jwt.trustTrack.privateKey, {
        algorithms: global.config.jwt.trustTrack.alg
      })
      console.log('--', decoded)

      let deviceInfo = await DevicesModel.findOne({
        where: {
          id: decoded.deviceId,
          is_active: true
        },
        raw: true
      })
      if (!deviceInfo) {
        console.log("-----------Invalid Device Id");
        return res.status(401).send({ success: 0, message: "This device isn't authorized!" })

      }
      const userDetails = await CompanyUserModel.findOne({
        where: {
          id: decoded.userId,
          location_id: deviceInfo.location_id
          // location_id: {
          //     [Op.or]: [null, deviceInfo.location_id]
          // }
          // jwt_token: token  // Commenting here for same user login at multiple devices at the same time
        },
        raw: true,
      });
      if (!userDetails) {
        console.log('---User Not Found--');
        return res.status(401).send({
          success: 0,
          message: "Unauthorized Access!"
        });
      }

      req.roleId = userDetails.role_id;
      req.userId = userDetails.id;
      req.locationId = userDetails.location_id;
      req.deviceId = deviceInfo.id
      console.log("Req Validated", "lcoationId", req.locationId);
      next();
    } else {
      return res.status(401).send({ success: 0, message: "Unauthorized Access!" });
    }
  } catch (error) {
    console.error(error);
    return res.status(401).send({ success: 0, message: "Unauthorized Access!" });
  }
};
