const app = require('express').Router();


module.exports = (function () {
  const deviceController = require('../../controllers/device');
  const userAccessMiddleware = require('../../middleware/userAccessValidator');

  app.get('/', userAccessMiddleware([0, 1, 2, 3, 21]), deviceController.get);
  app.post('/', userAccessMiddleware([0, 1, 2, 3, 21]), deviceController.add);
  app.put('/:id', userAccessMiddleware([0, 1, 2, 3, 21]), deviceController.update);
  app.get('/:id', userAccessMiddleware([0, 1, 2, 3, 21]), deviceController.getDetailsById);
  return app;
})();

