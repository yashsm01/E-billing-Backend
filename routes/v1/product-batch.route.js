
const app = require('express').Router();
const productBatchController = require('../../controllers/product_batch');
const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {

  app.get("/byProductId/:productId", userAccessMiddleware([0, 1, 2, 3, 5, 8, 17, 21]), productBatchController.productBatchList);
  app.post("/", userAccessMiddleware([0, 1, 2, 3, 5, 8, 17, 21]), productBatchController.add);
  app.get("/", userAccessMiddleware([0, 1, 2, 3, 5, 8, 17, 21]), productBatchController.list);


  app.post("/add", userAccessMiddleware([0, 1, 2, 3, 5, 8, 17, 21]), productBatchController.addRetailerBatch);
  app.put("/update/:retailerBatchId", productBatchController.updateRetailerBatch);

  //Excel Upload
  app.post("/add/excel", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), productBatchController.bulkAdd);

  return app;
})();