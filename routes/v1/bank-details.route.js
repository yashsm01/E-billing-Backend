const app = require('express').Router();

module.exports = (function () {
  const controller = require('../../controllers/bank-details');
  const userAccessMiddleware = require('../../middleware/userAccessValidator');

  app.post('/add', controller.add);
  app.get('/list', controller.list);

  return app;
})();