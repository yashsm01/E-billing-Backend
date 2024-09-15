
const app = require('express').Router();
const ValidateNSyncController = require("../../controllers/desktop/validate-n-sync");

module.exports = (function () {
    app.post(`/verify/system-software`, ValidateNSyncController.validateAccess);
    app.post(`/manually-sync`, ValidateNSyncController.manualSync);
    return app;
})();