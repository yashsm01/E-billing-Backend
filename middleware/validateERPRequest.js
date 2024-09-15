const sKey = require('../config/gsp-secret').key;
const jwt = require('jsonwebtoken');

const crypto = require('crypto');

const xml2js = require('xml2js');
const builder = new xml2js.Builder();


module.exports = async (req, res, next) => {
  try {
    let userName = req.headers.username;
    let password = req.headers.password;

    if (userName == global.config.ttERPCredentials.userName && password == global.config.ttERPCredentials.password) {
      console.log("Request Validated");
      next();
      // return { success: 1, message: '' }
    } else {
      return res.status(401).send({ success: 0, message: "Unauthorized Access!" })
      // let xmlRes = await generateXMLResponse("Unauthorized Access!")
      // return res.send(xmlRes);
    }

  } catch (error) {
    console.error(error);
    return res.status(401).send({ success: 0, message: "Internal Server Error" });
    // let xmlRes = await generateXMLResponse("Internal Server Error")
    // return res.send(xmlRes);
  }
};
async function generateXMLResponse(string) {
  let jsonData = {
    "string": string
  };
  let xml = builder.buildObject(jsonData);
  return xml;
}