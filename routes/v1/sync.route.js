
const app = require('express').Router();
const syncController = require('../../controllers/sync');
const localToCloudController = require('../../controllers/localToCloud/upload-codes');
const scaningController = require("../../controllers/Devices/device-scanning");
// const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {

  app.get("/products", syncController.syncProducts);
  app.get("/batches", syncController.syncBatches);
  app.get("/categories", syncController.syncCategories);
  app.get("/users", syncController.syncUsers);
  app.get("/devices", syncController.syncDevices);
  app.get("/location", syncController.syncLocations);
  app.get("/system-access", syncController.syncFactoryServer);
  app.get("/storage-bins", syncController.syncStorageBins);
  app.get("/production-orders", syncController.syncProdutionOrders);
  app.get("/check-uids", syncController.synDynamicUids);
  app.get("/qrcode-parents", syncController.syncCodeParents);

  app.get("/lastSync", syncController.lastSyncUpdate);

  app.post("/upload-lvl-codes", localToCloudController.syncUploadCodes);

  app.post("/deaggregation-varification", scaningController.verifySentFile);
  app.post("/dropcodes-varification", scaningController.verifyDropSentFile);

  return app;
})();

