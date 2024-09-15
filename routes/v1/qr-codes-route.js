const app = require('express').Router();
const salescontroller = require('../../controllers/sales_management');
const PRcontroller = require('../../controllers/purchase-return');
const stockcontroller = require('../../controllers/retailer_stock');


const userAccessMiddleware = require('../../middleware/userAccessValidator');
module.exports = (function () {

  app.get("/sales-invoice/:qrCode", salescontroller.QrCodeDetail);
  app.get("/PRinvoice/:qrCode", PRcontroller.QrCodeDetail);
  app.get("/stock/:qrCode", stockcontroller.getStockDetailbyqrCode);

  return app;
})();

