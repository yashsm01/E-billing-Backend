
const app = require('express').Router();
const userAccessMiddleware = require('../../middleware/userAccessValidator');
const businessUserController = require('../../controllers/businessuser');

module.exports = (function () {

  app.get('/', userAccessMiddleware([0, 1, 2, 3]), businessUserController.list);
  app.get('/details/:id', userAccessMiddleware([0, 1, 2, 3]), businessUserController.detail);

  app.post('/', userAccessMiddleware([0, 1, 2, 3]), businessUserController.add);
  app.put('/:id', userAccessMiddleware([0, 1, 2, 3]), businessUserController.update);
  return app;
})();

