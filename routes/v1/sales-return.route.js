const app = require('express').Router();

module.exports = (function () {
  const controller = require('../../controllers/sales_return');
  const userAccessMiddleware = require('../../middleware/userAccessValidator');


  app.get('/list-return', userAccessMiddleware([2]), controller.list);
  app.post('/add-return', userAccessMiddleware([2]), controller.add);
  app.get('/details-return/:id', userAccessMiddleware([2]), controller.details);
  app.put('/update-return/:id', userAccessMiddleware([2]), controller.update);

  return app;
})();