const app = require('express').Router();
const consumerController = require('../../controllers/pwa.js');
const notifications = require('../../controllers/consumerapi/notifications.js');

module.exports = (function () {
  app.get("/getCustomerDetail", consumerController.getCustomerDetail);// done
  app.get('/getCityIdAndStateId', consumerController.getStateAndCityId);
  app.post('/claim-rewards', consumerController.claimRewards);// done
  // app.post('/addRewards', consumerController.addRewards);
  // app.post("/add-scratch-cards", consumerController.add);
  // app.post('/addProductRegister', consumerController.addProductRegister);
  app.post('/register/product', consumerController.registerProduct);// done
  app.post('/counterfit/register/product', consumerController.counterfitRegister);

  app.get("/findByQrCode", consumerController.findByQrCode);
  app.get("/scan-code", consumerController.scanCode);// done
  app.get("/scratch-card", consumerController.getScractchCard);// done
  app.post('/card-scratched', consumerController.cardScratched);// done
  app.get("/all-scratch-cards", consumerController.getAllScratchCards);
  app.get("/total-points", consumerController.totalPoints);// done
  app.get("/", consumerController.totalPoints);// done
  app.get("/scan-history", consumerController.allRegisteredProduct);
  app.get("/rewards", consumerController.getRewards);// done
  app.post('/reedem-reward', consumerController.redeemReward);// done
  app.get('/loyalty-offers', consumerController.loyaltyOffers);
  app.get("/offers", consumerController.offers);
  app.get('/user-address', consumerController.getAddress);// done
  app.get('/rewardhistory', consumerController.rewardHistoryList);// done
  app.put('/update-scratchcard', consumerController.updateScratchCard);
  app.post('/lucky-rewardredeem', consumerController.luckyRewardRedeem);

  app.get("/notifications", notifications.getNotifications);
  app.delete("/delete-notifications", notifications.deleteNotifications);
  app.get("/update-notifications", notifications.updateNotifications);
  app.get("/getUserLocationInfo", consumerController.getUserocationInfo);
  app.get("/luckyDrawUnlocked", consumerController.luckyDrawUnlockedInfo)
  return app;
})();
