
const app = require('express').Router();
const stockReportController = require('../../controllers/stock_report');
const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {

  app.get("/list", userAccessMiddleware([0, 1, 2, 3, 8, 17, 20]), stockReportController.getList);
  app.get("/detailedStockList", userAccessMiddleware([0, 1, 2, 3, 8, 17, 20]), stockReportController.detailedStockList);
  app.get("/byProductId", userAccessMiddleware([0, 1, 2, 3, 8, 17, 20]), stockReportController.stockListByProduct);

  app.post("/export", userAccessMiddleware([0, 1, 2, 3, 8, 17, 20]), stockReportController.exportStockReport);
  app.post("/download", userAccessMiddleware([0, 1, 2, 3, 8, 17, 20]), stockReportController.exportTransactionReport);
  app.post("/downloadErp", userAccessMiddleware([0, 1, 2, 3, 8, 17, 20]), stockReportController.exportErpSyncReport);
  app.post("/inventoryReport", userAccessMiddleware([0, 1, 2, 3, 8, 17, 20]), stockReportController.exportInventoryReport);
  app.post("/productionReport", userAccessMiddleware([0, 1, 2, 3, 8, 17, 20]), stockReportController.exportProductionReport);
  app.post("/codeGenerationReport", userAccessMiddleware([0]), stockReportController.exportCodeGenerationReport);
  app.post("/supplyChainReport", userAccessMiddleware([0, 1, 2, 3, 8, 17, 20]), stockReportController.exportSupplyChainReport);
  app.post('/userRegisterInfo', userAccessMiddleware([0, 1, 2, 3, 8, 17, 20]), stockReportController.schemeUserResponse);
  app.post('/luckyDrawUserRegisterInfo', userAccessMiddleware([0, 1, 2, 3, 8, 17, 20]), stockReportController.luckyDrawUserResponse);
  return app;
})();

