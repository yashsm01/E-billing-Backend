
const app = require('express').Router();
const routerController = require('../../controllers/sales_management');
const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {
  app.get("/list", routerController.list);
  app.post("/add", routerController.add);
  app.put("/update/:id", routerController.update);
  app.get("/details/:id", routerController.details);
  app.post("/saveAsDraft", routerController.saveAsDraft);
  return app;
})();

