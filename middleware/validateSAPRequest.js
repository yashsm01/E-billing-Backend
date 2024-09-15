const CompanyUsers = require('../models/').company_users;
const jwt = require('jsonwebtoken');

module.exports = async (req, res, next) => {
  try {
    let token = req.headers['x-access-token'];
    if (token != null && token != undefined && token != '') {
      let decoded = await jwt.verify(token, require("../config/sap_jwt_secret")());
      //check user details
      let user = await CompanyUsers.findOne({
        where: { email: decoded.username, sap_jwt_token: token },
        raw: true
      });
      if (!user) {
        return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
      }
      else {
        req.userId = user.id;
        req.locationId = user.location_id;
        req.roleId = user.role_id;
        next();
      }
    } else {
      return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
    }
  }
  catch (error) {
    console.log("err", error.message)
    return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
  }
}