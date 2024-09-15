const app = require('express').Router();


module.exports = (function () {
  const locationController = require('../../controllers/locations');
  const userAccessMiddleware = require('../../middleware/userAccessValidator');

  app.get('/list', locationController.getLocations);
  app.get('/all/location', userAccessMiddleware([0, 1, 2, 3, 4, 8, 17, 21]), locationController.getAllLocations);
  app.post('/add', locationController.add);
  // app.post('/', locationController.add);
  app.put('/:id', userAccessMiddleware([0, 1, 2, 3, 17, 21]), locationController.update);
  app.get('/details', userAccessMiddleware([0, 1, 2, 3, 5, 17, 21]), locationController.getDetailsById);
  app.put('/updateValidator/:id', userAccessMiddleware([0, 1, 2, 3, 17, 21]), locationController.updateValidator);
  return app;
})();




