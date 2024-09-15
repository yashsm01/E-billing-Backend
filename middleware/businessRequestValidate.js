

let checkDeviceToken = require('../controllers/businessapi/auth').checkDeviceToken;
const companyUser = require('../models/').company_users;

module.exports = async (req, res, next) => {

  try {
    let token = req.headers['x-access-token'];
    let key = req.headers['x-key'];

    if (token && key) {
      let verify = await checkDeviceToken(token, key);
      console.log(verify);
      if (!verify) {
        return res.status().send({
          success: 0,
          message: "Not Authorized",
          "status_code": "TTE003"
        });
      }

      const employee = await companyUser.findOne({
        where: {
          id: verify.user_id
        },
        attributes: ['company_id', 'location_id']
      });

      if (!employee) {
        return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
      }

      req.headers['x-key-companyId'] = employee.company_id;
      req.headers['locationId'] = employee.location_id;

      next();
    }
    else {
      return res.status(401).send({
        "status": 0,
        message: "Invalid Token or Key"
      });
    }

  } catch (err) {
    return res.status(500).send({
      "status": 0,
      message: "Oops something went wrong",
      "error": err
    });
  }
};