const app = require('express').Router();
const routerController = require('../../controllers/doctor');
const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {

  app.post("/search", routerController.search);
  app.post("/add", routerController.addDoctor);
  app.get("/list", routerController.list);
  app.put("/update/:doctorId", routerController.update);

  return app;
})();
