
const app = require('express').Router();
const syncController = require('../../controllers/sync');
const webController = require('../../controllers/web/web');
// const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {

  app.get("/product", webController.getCodeDetails);

  return app;
})();

