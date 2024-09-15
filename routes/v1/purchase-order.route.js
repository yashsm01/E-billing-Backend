const app = require('express').Router();
const purchaseOrderController = require('../../controllers/purchase-order');
const purchaseReturnController = require('../../controllers/purchase-return');
const userAccessMiddleware = require('../../middleware/userAccessValidator');
module.exports = (function () {

  app.get('/list', userAccessMiddleware([2]), purchaseOrderController.list);
  app.post('/add', purchaseOrderController.add);
  app.get('/details/:id', purchaseOrderController.details);
  app.put('/update/:id', userAccessMiddleware([2]), purchaseOrderController.update);


  app.post('/add-return', userAccessMiddleware([2]), purchaseReturnController.addPurchaseReturn);
  app.get('/list-return', userAccessMiddleware([2]), purchaseReturnController.listPurchaseReturn);
  app.get('/return-details/:id', purchaseReturnController.returnDetails);
  app.put('/return-update/:id', userAccessMiddleware([2]), purchaseReturnController.updateReturn);

  return app;
})();