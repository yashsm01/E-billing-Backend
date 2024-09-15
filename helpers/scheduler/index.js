const cron = require('node-cron');
const qrCodeController = require('./../../controllers/qr-codes-controller');

const models = require("../../controllers/_models");

let Scheduler = {
  execute: async function () {
    console.log('excute scheduler');

    // execute in every 5 mins
    cron.schedule('0 0 * * *', () => {
      console.log('------Adding unique codes to bank started 12:01 AM every day-----', new Date())
      qrCodeController.checkOrGenerateCodes();
    })

    // Execute Every minute
    cron.schedule('*/1 * * * *', async () => {

    });
  },
}
module.exports = Scheduler;