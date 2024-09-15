const app = require('express').Router();


module.exports = (function () {
  const customerController = require('../../controllers/customer');
  const userAccessMiddleware = require('../../middleware/userAccessValidator');

  // app.post('/add_from_excel/', userAccessMiddleware([0, 1, 2, 9]), customerController.add_from_excel); ///////iil
  // app.get('/financeLocationList/', userAccessMiddleware([0, 1, 2, 9]), customerController.financeLocationList);///////iil

  app.get('/', userAccessMiddleware([0, 1, 2, 9]), customerController.getCustomers);///////iil
  app.post('/', userAccessMiddleware([0, 1, 2, 9]), customerController.add);

  app.put('/:id', userAccessMiddleware([0, 1, 2, 9]), customerController.update);
  app.get('/details', userAccessMiddleware([0, 1, 2, 9]), customerController.getDetailsById);
  app.put('/updateValidator/:id', userAccessMiddleware([0, 1, 2, 9]), customerController.updateValidator);
  return app;
})();

