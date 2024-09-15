const app = require('express').Router();
const controller = require('../../controllers/production-order');
const userAccessMiddleware = require('../../middleware/userAccessValidator');
const productBatchController = require('../../controllers/product_batch');
module.exports = (function () {

  app.get('/', userAccessMiddleware([0, 1, 2, 3, 4, 21]), controller.list);
  app.post('/', userAccessMiddleware([0, 1, 2, 3, 21]), controller.add);
  app.post('/generation-counts', userAccessMiddleware([0, 1, 2, 3, 21]), controller.getPOCodeCounts);
  app.get('/byId/:id', userAccessMiddleware([0, 1, 2, 3, 5, 21]), controller.getDetailsById);
  app.get('/ponumber', userAccessMiddleware([0, 1, 2, 3, 4, 21]), controller.getNextPoNumber);
  app.get('/byproduct/:id', userAccessMiddleware([0, 1, 2, 3, 4, 21]), controller.listByProductId);
  app.get('/byproduct/reprot/:id', userAccessMiddleware([0, 1, 2, 3, 4, 21]), controller.listByProductIdForReport);
  app.get('/production/report/:id', userAccessMiddleware([0, 1, 2, 3, 4, 21]), controller.getProductionInfo);
  app.get('/mapping/report', userAccessMiddleware([0, 1, 2, 3, 4, 21]), controller.getMappingInfo);
  app.post('/complete', userAccessMiddleware([0, 1, 2, 3, 21]), controller.completePO);
  app.get('/check-batch', userAccessMiddleware([0, 1, 2, 3, 4, 21]), productBatchController.checkBatch);
  app.get('/sync-to-erp', userAccessMiddleware([0, 1, 2, 3, 4, 21]), productBatchController.checkBatch);
  app.get('/poNumberList', userAccessMiddleware([0, 1, 2, 3, 4, 21]), controller.getPoNumberList);
  return app;
})();

