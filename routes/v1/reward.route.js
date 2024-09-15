const app = require('express').Router();
const RewardController = require('../../controllers/reward');
const userAccessMiddleware = require('../../middleware/userAccessValidator');

module.exports = (function () {
  app.get("/detail", userAccessMiddleware([0, 1, 7, 17, 18, 19, 20]), RewardController.rewardDetailById);
  app.get("/redeemedRequests", userAccessMiddleware([0, 1, 2, 7, 17, 18, 19, 20]), RewardController.redeemRequests);
  app.get("/luckydraw-rewards", userAccessMiddleware([0, 1, 2, 7, 17, 18, 19, 20]), RewardController.rewardList);
  app.get("/luckydraws/details-by-id", userAccessMiddleware([0, 1, 2, 7, 17, 18, 19, 20]), RewardController.DetailsById);
  app.get("/luckydraws/draw-history", userAccessMiddleware([0, 1, 2, 7, 17, 18, 19, 20]), RewardController.GetDrawHistory);
  app.get("/rewards/history", userAccessMiddleware([0, 1, 2, 7, 17, 18, 19, 20]), RewardController.history);
  app.get("/rewards/list", userAccessMiddleware([0, 1, 2, 7, 17, 18, 19, 20]), RewardController.getRewardsList);
  app.get("/rewards/delete", userAccessMiddleware([0, 1, 2, 7, 17, 18, 19, 20]), RewardController.deleteReward);
  app.get("/luckydraws", userAccessMiddleware([0, 1, 2, 7, 17, 18, 19, 20]), RewardController.getLuckyDraws);
  app.post("/luckydraws/list", userAccessMiddleware([0, 1, 7, 17, 18, 19, 20]), RewardController.getLuckyDrawsList);
  app.get("/pointAllocation/list", userAccessMiddleware([0, 1, 2, 7, 17, 18, 19, 20]), RewardController.list);
  app.get("/product/list/sku-names", userAccessMiddleware([0, 1, 2, 7, 17, 18, 19, 20]), RewardController.getSKUList);
  app.get("/pointAllocation/detail", userAccessMiddleware([0, 1, 2, 7, 17, 18, 19, 20]), RewardController.detail);
  app.post("/getBatchByMultipleSku", userAccessMiddleware([0, 1, 2, 7, 17, 18, 19, 20]), RewardController.getBatchByMultipleSku);


  app.post("/add-luckydraw", userAccessMiddleware([0, 1, 7, 17, 18, 19, 20]), RewardController.luckyDrawAdd);
  app.post("/luckydraws/change-status", userAccessMiddleware([0, 1, 7, 17, 18, 19, 20]), RewardController.ChangeStatus);
  app.post("/rewards/add", userAccessMiddleware([0, 1, 7, 17, 18, 19, 20]), RewardController.rewardAdd);
  app.post("/rewards/edit", userAccessMiddleware([0, 1, 7, 17, 18, 19, 20]), RewardController.editReward);
  app.post("/pointAllocation/add", userAccessMiddleware([0, 1, 7, 17, 18, 19, 20]), RewardController.pointAllocationAdd);
  app.post("/pointAllocation/bulk-add", userAccessMiddleware([0, 1, 7, 17, 18, 19, 20]), RewardController.pointAllocationBulkAdd);

  app.delete("/pointAllocation/delete", userAccessMiddleware([0, 1, 7, 17, 18, 19, 20]), RewardController.delete);
  app.put("/pointAllocation/update", userAccessMiddleware([0, 1, 7]), RewardController.edit);
  app.put("/redeemedRequests", userAccessMiddleware([0, 1, 7]), RewardController.updateRedeemRequests);

  app.put("/pointAllocation/update", userAccessMiddleware([0, 1, 7, 17, 18, 19, 20]), RewardController.newEdit);
  app.put("/redeemedRequests", userAccessMiddleware([0, 1, 7, 17, 18, 19, 20]), RewardController.updateRedeemRequests);


  app.post("/pointAllocation/lists", userAccessMiddleware([0, 1, 7, 17, 18, 19, 20]), RewardController.pointAllocationlist);
  return app;
})();