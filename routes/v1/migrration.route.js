const app = require('express').Router();


module.exports = (function () {
  const migrationController = require('../../controllers/migration');

  app.post('/product/add', migrationController.getproducts);
  return app;
})();

