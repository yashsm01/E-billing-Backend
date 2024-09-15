const app = require('express').Router();
const common = require('../../controllers/common');
const userAccessMiddleware = require('../../middleware/userAccessValidator');
const consumerController = require('../../controllers/pwa')
module.exports = (function () {
  app.get("/company-roles", userAccessMiddleware([0, 0, 1, 2, 3, 4, 5, 17, 21]), common.companyRolesList);
  app.get("/customer-list", userAccessMiddleware([0, 0, 1, 2, 3, 5, 17, 21]), common.getCustomerCareList);

  app.get("/country/", common.country);
  app.get("/state/:countryId", common.stateList);
  app.get("/district/:stateId", common.districtList);
  app.get("/taluka/:districtId", common.talukaList);
  app.get("/cities/:talukaId", common.citiesList);

  app.get("/cityByDistrictId/:districtId", common.cityListByDistrictId);
  app.get("/city/:stateId", common.citylist);
  app.get("/customer-care/details", userAccessMiddleware([0, 1, 2, 3, 5, 17, 20, 21]), common.getCustomerCareDetails);
  app.post("/customer-care/add", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), common.addCustomerCareDetails);
  app.put("/customer-care/edit/:id", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), common.updateCustomerCareDetails);
  app.get("/customer-care/list", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), common.getCustomerCareList);
  app.get("/uom/list", common.getUOMList);
  app.get("/customercare", common.getCustomerCareDetailsOpen);

  //Selection Of Multi Country/State/district
  app.post("/state", common.getMultiStateList);
  app.post("/district", common.getMultiDistrictList);
  app.post("/territory", common.getMultiTerritoryList);

  app.get("/product-info", consumerController.scanCode);
  app.get('/getCityIdAndStateId', consumerController.getStateAndCityId);
  app.get("/getPincodeByCityId/", common.pincodeByCityId);
  app.post("/pwa/versions", common.pwaVersionAdd);
  app.get('/get/pwa/versions', common.getPwaVersionsList);

  app.get("/pwaLatestVersion", common.pwaLatestVersion);

  app.post("/esign-update", common.esignUpdate);
  app.post("/send-otp", common.sendOtp);
  app.post("/verify-otp", common.verifyOtp);

  return app;
})();
