
const app = require('express').Router();
const routerController = require('../../controllers/retailers');
const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {
  app.get("/list", routerController.list);
  app.put("/update/:id", routerController.update);
  app.get("/details/:id", routerController.details);
  return app;
})();

