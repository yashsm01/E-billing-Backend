
const app = require('express').Router();
const routerController = require('../../controllers/features');
const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {

  app.get("/list", routerController.list);

  return app;
})();

