const jwt = require('jsonwebtoken');
const Sequelize = require("sequelize");
const en = require('../i18n/en');
const Op = Sequelize.Op;
const CONSTANT = require("../config/const");
const env = process.env.APP_ENV || 'dev';
const config = require(`${__dirname}/../config/${env}-config.json`);


//models
const models = require("../controllers/_models");

module.exports = async (req, res, next) => {
  try {
    let token = req.headers['access-token'];

    if (token) {
      let decoded = await jwt.verify(token, config.jwt.syncServer.privateKey);

      if (!decoded || !decoded.mId)
        return res.status(401).json({ success: 0, message: "Not Authorized", "status_code": "TTE003" });

      let mId = decoded.mId;

      const accessInfo = await models.systemAccessModel.findOne({
        where: {
          u_id: mId,
          is_active: true
        },
        attributes: ['id', 'location_id', 'last_sync_at', 'local_last_sync_at'],
        raw: true
      });

      if (!accessInfo)
        return res.status(401).send({ success: 0, message: "Access Denied!" });

      let isLocationAvailable = await models.locationModel.findOne({
        where: {
          id: accessInfo.location_id
        }
      });

      if (!isLocationAvailable) {
        return res.status(401).send({ success: 0, message: "Access Denied!" });
      }
      if (accessInfo.location_id != isLocationAvailable.id) {
        return res.status(401).send({ success: 0, message: "Unauthorized User!" })
      }
      req.deviceId = accessInfo.id;
      req.locationId = accessInfo.location_id;
      req.locationName = isLocationAvailable.unique_name  // for database backup folder name
      req.lastSyncAt = accessInfo.last_sync_at;
      req.mId = mId;
      req.localLastSyncAt = accessInfo.local_last_sync_at;
      next();

    } else
      return res.status(401).send({ success: 0, message: "Invalid Token or Key" });

  } catch (ex) {
    console.log(ex);
    return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
  }

};