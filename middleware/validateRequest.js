let checkJwtToken = require('../controllers/auth').checkJwtToken;
const models = require("../controllers/_models.js");
const jwt = require('jsonwebtoken');
const Sequelize = require("sequelize");
const en = require('../i18n/en');
const Op = Sequelize.Op;
const CONSTANT = require("../config/const");

module.exports = async (req, res, next) => {
  try {
    let token = (req.body && req.body.access_token) || (req.query && req.query.access_token) || req.headers['x-access-token'];
    if (!token) {
      return res.status(401).json({ success: 0, message: "Not Authorized", "status_code": "TTE003" });
    }
    const uuidV4Regex = /^[A-F\d]{8}-[A-F\d]{4}-4[A-F\d]{3}-[89AB][A-F\d]{3}-[A-F\d]{12}$/i;
    let decoded = await jwt.verify(token, require('../config/secret.js')());
    let key;
    if (decoded) {
      key = decoded.user_token;
    }
    if (token && key) {
      if (!uuidV4Regex.test(key)) {
        // console.log(key, token);
        const userData = await models.CompanyUserModel.findOne({
          where: {
            random_id: key,
            jwt_token: token,
            role_id: {
              [Op.in]: [0, 1, 2]
            },
          },
          include: [
            {
              model: models.RetailerModel,
              attributes: ['id', 'name'],
              as: 'retailers',
              raw: true,
              nest: true
            },
            {
              model: models.retailerOutletsModels,
              attributes: ['id', 'name', 'table_uid'],
              as: 'retailer_outlets',
              raw: true,
              nest: true
            },
          ],
          nest: true,
          raw: true
        });
        if (!userData) {
          return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
        } else if (!userData.is_email_verified) {
          return res.status(401).send({ success: 0, message: en.emailNotVerified });
        }
        else if (userData.failed_login_attempt_count >= CONSTANT.loginFailed.blockAfterAttempt) {
          return res.status(401).send({ success: 0, message: CONSTANT.loginFailed.failedMessage });
        }
        else if (userData.last_activity_at != null) {
          let activityDiff = new Date().getTime() - userData.last_activity_at.getTime();
          let diffInMinutes = Math.round(activityDiff / 60000);
          if (diffInMinutes > CONSTANT.afterInactivityTokenExpired) {
            await models.CompanyUserModel.update({
              jwt_token: null
            }, {
              where: {
                random_id: key,
                jwt_token: token,
              }
            });
            return res.status(401).send({ success: 0, message: "Session Expired" });
          } else {
            await models.CompanyUserModel.update({
              last_activity_at: new Date()
            }, {
              where: {
                random_id: key,
                jwt_token: token,
              }
            });
          }
        }
        req.userId = userData.id;
        req.roleId = userData.role_id;
        req.locationId = userData.location_id;
        req.retailerId = userData.retailer_id;
        req.retailOutletId = userData.retail_outlet_id;
        req.tableUid = userData.retailer_outlets.table_uid;
        console.log(userData.retailer_id, "......................retailer")
        console.log(userData.retailOutletId, "......................retaileroutlate")

        next();
      }
      else {
        return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
      }
    }
    else {
      return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
    }
  } catch (ex) {
    console.log(ex);
    return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
  }

};