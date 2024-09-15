
const app = require('express').Router();
const productController = require('../../controllers/product');
const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {

  app.post("/search", userAccessMiddleware([0, 1, 2, 3, 4, 5, 7, 8, 13, 14, 15, 16, 17, 20, 21]), productController.search);
  app.post("/verify-products", userAccessMiddleware([0, 1, 2]), productController.productVerification);
  app.get("/", userAccessMiddleware([0, 1, 2, 3, 4, 5, 7, 8, 13, 14, 15, 16, 17, 20, 21]), productController.list);
  app.post("/add", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), productController.add);

  app.post("/add/excel", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), productController.bulkAdd);
  app.get("/details/:productId", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), productController.details);
  app.put("/:productId", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), productController.update);
  app.get("/companyDetails", userAccessMiddleware([0, 1, 2, 3, 17, 20, 21]), productController.companyDetails);
  return app;
})();

