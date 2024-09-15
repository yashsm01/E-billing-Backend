const app = require('express').Router();
const retailerStockController = require('../../controllers/retailer_stock');
const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {
  app.get('/product/list', retailerStockController.stockListProductWise);
  app.get('/batch-stock/:id', retailerStockController.stockLocationDetailsbyPoId);
  return app;
})();
