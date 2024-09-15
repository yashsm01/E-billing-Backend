const app = require('express').Router();
const distributorsController = require('../../controllers/distributors');
const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {

  app.post("/search", userAccessMiddleware([0, 1, 2, 3, 4, 5, 7, 8, 13, 14, 15, 16, 17, 20, 21]), distributorsController.search);
  app.put("/update/:distributorId", userAccessMiddleware([0, 1, 2, 3, 4, 5, 7, 8, 13, 14, 15, 16, 17, 20, 21]), distributorsController.update);

  app.get("/list", userAccessMiddleware([0, 1, 2, 3, 4, 5, 7, 8, 13, 14, 15, 16, 17, 20, 21]), distributorsController.list);
  // app.post("/", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), productController.add);
  app.post("/add/excel", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), distributorsController.bulkAdd);
  app.post("/add_distributor", distributorsController.add_distributor)
  // app.get("/details/:productId", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), productController.detail);
  // app.put("/:productId", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), productController.update);
  // app.get("/companyDetails", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), productController.companyDetails);
  return app;
})();

