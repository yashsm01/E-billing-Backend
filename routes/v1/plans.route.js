
const app = require('express').Router();
const routerController = require('../../controllers/plans');
const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {

  app.get("/list", routerController.list);
  app.post("/add", routerController.add)


  return app;
})();

