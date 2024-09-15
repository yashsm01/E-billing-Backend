const app = require('express').Router();
const productController = require('../../controllers/product');
const poController = require('../../controllers/production-order');
const userAccessMiddleware = require('../../middleware/userAccessValidator');
const scanningController = require('../../controllers/Devices/device-scanning');
const batchController = require('../../controllers/product_batch');

module.exports = (function () {
  app.get("/product/list", productController.list);
  app.get('/polist/byproduct/:id', poController.listByProductId);
  app.post('/add/transaction', scanningController.addTransaction);
  app.get('/transaction/info', scanningController.getTransactionInfo);
  app.get('/transaction/pending', scanningController.getPendingTransaction);
  app.post('/scan-code', scanningController.scanCode);
  app.post('/discard', scanningController.discard);
  app.post('/transaction/complete', scanningController.completeTransaction);
  app.post('/History', scanningController.getHistory);

  app.get('/getBatchDetails/:batchId', batchController.getBatchById);
  app.get("/other/batch/check", batchController.checkBatch);
  app.get("/batches/:productId", batchController.scanBatchList);
  app.post('/replace', scanningController.replaceCode);
  app.post('/checkuid', scanningController.checkUID);
  app.post('/unmap-codes', scanningController.unmapCodesTree);

  // Other Mapping
  app.get("/other/batches/:productId", batchController.productBatchList);
  app.post('/other/add/transaction', scanningController.addOtherTransaction);//
  app.get('/other/transaction/pending', scanningController.getOtherPendingTransaction);//
  app.get('/other/transaction/info', scanningController.getOtherTransactionInfo);//
  app.post('/other/scan-code', scanningController.scanOtherCode);//
  app.post('/other/discard', scanningController.discardOther);//
  app.post('/other/delete', scanningController.deleteOther);//  
  app.post('/other/transaction/complete', scanningController.completeOther);//
  return app;
})();

