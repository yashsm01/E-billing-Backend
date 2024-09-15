const app = require('express').Router();


module.exports = (function () {
  const companyController = require(`../../controllers/industryapi/industry`)
  const userAccessMiddleware = require('../../middleware/userAccessValidator');

  app.get('/list', companyController.getCompanyList);
  app.post('/add', companyController.addCompany);
  return app;
})();
