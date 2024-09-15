const app = require('express').Router();

module.exports = (function () {
  const CategoryController = require('../../controllers/categories');
  const userAccessMiddleware = require('../../middleware/userAccessValidator');

  app.get('/list', userAccessMiddleware([0, 1, 2, 3, 4, 5, 7, 8, 13, 14, 15, 16, 17, 20, 21]), CategoryController.list);
  app.post('/add', userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), CategoryController.add);
  return app;
})();