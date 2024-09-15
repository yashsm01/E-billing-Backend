const app = require('express').Router();
const routerController = require('../../controllers/rack-location-discount');
const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {

  app.post("/update", routerController.addOrUpdateRackLocation);

  return app;
})();
