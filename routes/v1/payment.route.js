const app = require('express').Router();
const controller = require('../../controllers/payment');
const userAccessMiddleware = require('../../middleware/userAccessValidator');
module.exports = (function () {

  app.get('/dist-payment-list', userAccessMiddleware([2]), controller.list);
  app.get('/cust-payment-list', userAccessMiddleware([2]), controller.cust_list);

  app.get('/dist-payment-list/:distributor_id', userAccessMiddleware([2]), controller.list_distritbutor);
  app.get('/cust-payment-list/:customer_id', userAccessMiddleware([2]), controller.list_customer);

  app.get('/clear-dist-list/:distributor_id', userAccessMiddleware([2]), controller.clear_distritbutor);
  app.get('/clear-cust-list/:customer_id', userAccessMiddleware([2]), controller.clear_customer);

  return app;
})();