const app = require('express').Router();
const purchaseOrderController = require('../../controllers/purchase-order');
const userAccessMiddleware = require('../../middleware/userAccessValidator');


module.exports = (function () {

  return app;
})();