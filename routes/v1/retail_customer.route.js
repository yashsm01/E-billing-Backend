const app = require('express').Router();
const routerController = require('../../controllers/retail_customer');
const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {

  app.post("/addRetailCustomer", routerController.addRetailCustomer);
  app.get("/list", routerController.list);
  app.post("/search", routerController.search);
  app.put("/update/:retailCustomerId", routerController.update);

  return app;
})();

