//helpers
const parseValidate = require("../middleware/parseValidate");
const logger = require('../helpers/logger');

//controllers 
const commonController = require("./common");
const retailStockController = require("./retailer_stock");
const qrCodeController = require("./qr-codes-controller");

module.exports = {
  //helpers
  parseValidate,
  logger,
  //controllers 
  commonController,
  retailStockController,
  qrCodeController
};