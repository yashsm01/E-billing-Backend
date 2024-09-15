const app = require('express').Router();
const counterfietController = require('./../../controllers/counterfeiting')


module.exports = (function () {
  const dashboardController = require('../../controllers/dashboard');
  const userAccessMiddleware = require('../../middleware/userAccessValidator');

  app.post('/Doughnut', dashboardController.schemeBaseDoughnutDetails);
  app.post('/lineChart', dashboardController.schemeBaseLineDetails);
  app.post('/map', dashboardController.schemeBaseMapDetails);
  app.post('/counterfit', userAccessMiddleware([0, 1, 2, 3, 4, 8, 17]), dashboardController.getCounterfitCustomer)
  app.get('/getFrequency', counterfietController.sameCodeScannedInDiffLocation);
  app.get('/same-number-scan-multiple-codes', counterfietController.sameNumberScanMultipleCodes);
  app.get('/multiple-codes-scanned-in-same-location', counterfietController.multipleCodesScannedInSameLocation);
  app.get('/expired-codes-scanned-in-any-location', counterfietController.expCodesScannedFromAnyLoc);
  // e-billing
  app.get('/getChartData/:timeframe', dashboardController.getChartData);
  app.get('/getExpiredData/:status', dashboardController.getExpiredData);
  app.get('/getCustomerData', dashboardController.getCustomerData);
  app.get('/getDistributorData', dashboardController.getDistributorData);
  return app;
})();

