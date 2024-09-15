const v = require('node-input-validator');
const logger = require("../helpers/logger");
const rewardredeemhistoryData = require('../models/').reward_redeem_history;
const Reward = require('../models/').rewards;
const consumers = require("../models/").consumers;
const Transactions = require("../models/").redeem_points_transactions;
const ProductReward = require("../models/").product_rewards;
const LuckyDrawModel = require("../models").lucky_draws;
const LuckyDrawHistory = require("../models").luckydraw_history;
const scratchCardModel = require("../models").scratch_cards;
const pointAllocation = require("../models/").point_allocation;
const product = require("../models/").products;
const State = require("../models/").state;
const message = require('../i18n/en');
const randomstring = require('randomstring');
const msg = require("../i18n/en");
const uuid = require('uuid');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const moment = require('moment');
const path = require("path");
const parseValidate = require('./../middleware/parseValidate');
const dealerMobiles = require("../models").dealer_mobileno;
const productBatch = require("../models").product_batches;
const Category = require("../models/").categories;
const ProductGroup = require("../models/").product_group;
const ProductRange = require("../models/").product_range;
const ChannelPartners = require("../models").channel_partners;
const DynamicModels = require('../models/dynamic_models');
const City = require('../models').city;
const Pincodes = require('../models/').pincodes;
const cron = require('node-cron');
const models = require("./_models");
const db = require('../models');
const LuckyDrawControllers = require("../controllers/lucky_draw");

pointAllocation.hasOne(product, { foreignKey: 'id', sourceKey: 'sku_id' });
rewardredeemhistoryData.hasOne(Reward, {
  foreignKey: 'id',
  sourceKey: 'reward_id'
});

rewardredeemhistoryData.hasOne(consumers, {
  foreignKey: 'id',
  sourceKey: 'consumer_id'
});
rewardredeemhistoryData.belongsTo(Reward, {
  foreignKey: 'reward_id'
});
Reward.hasOne(rewardredeemhistoryData, {
  foreignKey: 'id',
  sourceKey: 'reward_id'
});

LuckyDrawModel.hasOne(Reward, {
  foreignKey: 'id',
  sourceKey: 'reward_id'
});

LuckyDrawModel.hasOne(models.parentZoneHistoryMasterModels, {
  foreignKey: 'id',
  sourceKey: 'zones'
});

LuckyDrawModel.hasOne(models.zoneHistoryMasterModels, {
  foreignKey: 'id',
  sourceKey: 'regions'
});

scratchCardModel.hasOne(dealerMobiles, {
  foreignKey: 'id',
  sourceKey: 'consumer_id'
});

scratchCardModel.hasOne(consumers, {
  foreignKey: 'id',
  sourceKey: 'consumer_id'
});

// models.pointAllocationModel.hasOne(models.parentZoneHistoryMasterModels, {
//   foreignKey: 'id',
//   sourceKey: 'zones'
// });

const rewardController = {
  redeemRequests: async (req, res) => {
    try {
      let validator = new v(req.query, {
        startDate: 'required',
        endDate: 'required'
      });

      let matched = await validator.check();
      if (!matched) {
        let ValidatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: ValidatorError });
      }

      let startDate = moment(req.query.startDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 00:00:00";
      let endDate = moment(req.query.endDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 23:59:59";

      let luckyDrawRedeemList = false;
      if (req.query.for == "ld") {
        luckyDrawRedeemList = true;
      }
      // reward_history_24
      let tableListQuery = `SELECT table_name FROM information_schema.tables WHERE table_name like 'reward_history%'`;
      let availableTable = await querySQl(tableListQuery);
      console.log("availableTable>>>>>>>>>>>>", availableTable);

      let newArrayTableList = availableTable.filter(function (item) {
        return item !== 'reward_history_undefined' && item !== 'reward_history_Invalid date';
      });

      newArrayTableList = newArrayTableList.map(x => {
        return x.substr(x.length - 2);
      })

      console.log("newArrayTableList>>>>>>>>>>>>>", newArrayTableList);

      let startYear = moment(startDate).format('YY');
      let endYear = moment(endDate).format('YY');

      console.log("start year>>>>>", startYear, ">>>>end year>>>>", endYear);
      let redeemHistory = [];
      // for (let i = startYear; i <= endYear; i++) {
      for (let i = 0; i < newArrayTableList.length; i++) {
        // let tableUID = i;
        let tableUID = newArrayTableList[i]; console.log("curr Year>>>", tableUID);
        let RewardRedeemHistoryModel = await DynamicModels.rewardHistoryModel(tableUID);
        console.log("customModel >>>>>>>>", RewardRedeemHistoryModel);

        RewardRedeemHistoryModel.hasOne(consumers, {
          foreignKey: 'id',
          sourceKey: 'consumer_id'
        })

        // RewardRedeemHistoryModel.hasMany(ChannelPartners, {
        //   foreignKey: 'id',
        //   sourceKey: 'consumer_id',
        // });

        RewardRedeemHistoryModel.hasOne(Reward, {
          foreignKey: 'id',
          sourceKey: 'reward_id',
        });
        RewardRedeemHistoryModel.hasOne(City, {
          foreignKey: 'id',
          sourceKey: 'city_id',
        });
        RewardRedeemHistoryModel.hasOne(State, {
          foreignKey: 'id',
          sourceKey: 'state_id',
        });
        RewardRedeemHistoryModel.hasOne(models.LuckyDrawModel, {
          foreignKey: 'id',
          sourceKey: 'scheme_id',
        });

        let redeemHistoryYY = await RewardRedeemHistoryModel.findAll({
          where: {
            is_luckydraw_reward: luckyDrawRedeemList,
            is_verified: 0,
            [Op.and]: [{ createdAt: { [Op.lte]: endDate } }, { createdAt: { [Op.gte]: startDate } }]
          },
          include: [{
            model: consumers
          },
          {
            model: Reward,
            attributes: ['name', 'id', 'is_wallet_based']
          },
          {
            model: State,
            attributes: ['name']
          },
          {
            model: City,
            attributes: ['name']
          },
          {
            model: models.LuckyDrawModel,
            attributes: ['draw_name']
          },
          ],
          raw: true,
          nest: true,
          attributes: ['id', 'customer_name', 'consumer_id', 'address', 'phone', 'createdAt', 'email', 'city_id', 'state_id', 'pin_code']
        });

        if (redeemHistoryYY) {
          // console.log(redeemedHistoryYY);
          redeemHistory = [...redeemHistory, ...redeemHistoryYY];
        }
        console.log("reward history>>>>", redeemHistory);
      }
      return res.status(200).send({
        success: '1',
        data: redeemHistory,
      });
    } catch (error) {
      console.log("error in get gift claims", error);
      return res.status(500).send({
        success: '0',
        message: error.message
      });
    }
  },
  rewardList: async (req, res) => {
    try {
      let reward_list = await Reward.findAll({
        where: {
          is_luckydraw_reward: true,
          is_deleted: false
        }
      });
      return res.status(200).send({ success: '1', data: reward_list })
    }
    catch (error) {
      console.log("error", error);
      logger.error(req, error);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  rewardDetailById: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: 'required'
      });
      let matched = await validator.check();
      if (!matched) {
        let ValidatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: '0', message: ValidatorError })
      }
      let detail = await Reward.findOne({ where: { id: req.query.id }, raw: true });
      if (!detail) {
        return res.status(200).send({ success: 0, message: 'No Reward Found' });
      }
      return res.status(200).send({ success: '1', data: detail })
    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  DetailsById: async (req, res) => {
    try {
      let validator = new v(req.query, {
        drawId: 'required'
      });
      let matched = await validator.check();
      if (!matched) {
        let ValidatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: '0', message: ValidatorError })
      }

      let luckyDrawDetail = await LuckyDrawModel.findOne({
        where: {
          id: req.query.drawId
        },
        include: [{
          model: Reward,
          attributes: ['id', 'name', 'reward_id']
        }
        ],
        raw: true,
        nest: true
      });

      let zoneList = await models.parentZoneHistoryMasterModels.findAll({
        where: {
          id: { [Op.in]: luckyDrawDetail.referance_zones }
        },
        attributes: ['id', 'name'],
        raw: true
      });

      let zones = zoneList.map(x => x.name);
      luckyDrawDetail.zones = zones;
      let regionList = await models.zoneHistoryMasterModels.findAll({
        where: {
          id: { [Op.in]: luckyDrawDetail.referance_regions }
        },
        attributes: ['id', 'name'],
        raw: true
      });
      let regions = regionList.map(x => x.name);
      luckyDrawDetail.regions = regions;

      let territoriesList = await models.territoryHistoryMasterModel.findAll({
        where: {
          terriotory_history_id: { [Op.in]: luckyDrawDetail.referance_territories }
        },
        attributes: ['id', 'name'],
        raw: true
      });
      let territories = territoriesList.map(x => x.name);
      luckyDrawDetail.territories = territories;

      let productSkus = await product.findAll({
        where: {
          id: { [Op.in]: luckyDrawDetail.skus }
        },
        attributes: ['id', 'sku'],
        raw: true
      })
      productSkus = await productSkus.map(x => x.sku);
      luckyDrawDetail.skus = productSkus;
      let productBatches = await productBatch.findAll({
        where: {
          id: { [Op.in]: luckyDrawDetail.product_batch }
        },
        attributes: ['id', 'batch_no'],
        raw: true
      })
      productBatches = await productBatches.map(x => x.batch_no);
      luckyDrawDetail.batches = productBatches;

      // lucky draw reward info find
      let rewardConfig = luckyDrawDetail.lucky_draw_winners_config;

      let rewardsData = [];

      if (rewardConfig != null && rewardConfig != undefined) {
        for (rc of rewardConfig) {
          let RewardsInfo = await Reward.findOne({
            where: {
              id: rc.reward_id
            },
            raw: true,
          });

          rewardsData.push({ reward: RewardsInfo.name, no_of_winners: rc.no_of_winners })
        }
      }
      luckyDrawDetail.rewardsData = rewardsData;
      return res.status(200).send({ success: '1', data: luckyDrawDetail })
    }
    catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  GetDrawHistory: async (req, res) => {
    try {
      let validator = new v(req.query, {
        drawId: 'required'
      });
      let matched = await validator.check();
      if (!matched) {
        let ValidatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: '0', message: ValidatorError })
      }

      let drawHistory = await LuckyDrawHistory.findAll({
        where: {
          draw_id: req.query.drawId
        },
        raw: true,
      });

      for (let his of drawHistory) {
        console.log("hisid", his);

        let winners = await scratchCardModel.findAll({
          where: {
            history_id: his.id,
            reward_id: { [Op.ne]: null },
            is_locked: false,
          },
          include: [{
            model: dealerMobiles,
            attributes: ['mobile_no', 'id', 'dealer_id']
          }, {
            model: consumers,
            attributes: ['name', 'phone']
          }],
          raw: true,
          nest: true
        });
        let winnerArr = [];
        console.log("winn", winners);
        for (let winner of winners) {

          let obj = {}
          if (winner.dealer_mobileno.mobile_no == null) {
            obj.winner_name = winner.consumer.name;
            obj.phone = winner.consumer.phone;
          } else {
            let primaryNo = await consumers.findOne({
              where: {
                id: winner.dealer_mobileno.dealer_id
              },
              raw: true
            })
            if (primaryNo) {
              obj.winner_name = primaryNo.name
            }
            obj.phone = winner.dealer_mobileno.mobile_no;
          }
          obj.qrcode = winner.qr_code;
          winnerArr.push(obj);
        }
        his.winners = winnerArr;
      }
      return res.status(200).send({ success: '1', data: drawHistory });
    }
    catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  history: async (req, res) => {
    try {

      let validator = new v(req.query, {
        startDate: 'required',
        endDate: 'required'
      });

      let matched = await validator.check();
      if (!matched) {
        let ValidatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: ValidatorError });
      }

      let startDate = moment(req.query.startDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 00:00:00";
      let endDate = moment(req.query.endDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 23:59:59";

      let startYear = moment(startDate).format('YY');
      let endYear = moment(endDate).format('YY');

      console.log("start year>>>>>", startYear, ">>>>end year>>>>", endYear);
      // reward_history_24
      let tableListQuery = `SELECT table_name FROM information_schema.tables WHERE table_name like 'reward_history%'`;
      let availableTable = await querySQl(tableListQuery);
      console.log("availableTable>>>>>>>>>>>>", availableTable);

      let newArrayTableList = availableTable.filter(function (item) {
        return item !== 'reward_history_undefined' && item !== 'reward_history_Invalid date';
      });

      newArrayTableList = newArrayTableList.map(x => {
        return x.substr(x.length - 2);
      })

      console.log("newArrayTableList>>>>>>>>>>>>>", newArrayTableList);


      // let redeemHistory;

      // let luckyDrawRedeemList = false;
      // if (req.query.for == "ld") {
      //   luckyDrawRedeemList = true;
      // }

      let luckyDraw = false
      if (req.query.for == "ld") {
        luckyDraw = true;
      }

      let redeemedHistory = [];
      // for (let i = startYear; i <= endYear; i++) {
      for (let i = 0; i < newArrayTableList.length; i++) {

        // let tableUID = i;
        let tableUID = newArrayTableList[i];
        console.log("curr Year>>>", tableUID);
        let RewardRedeemHistoryModel = await DynamicModels.rewardHistoryModel(tableUID);
        console.log("customModel >>>>>>>>", RewardRedeemHistoryModel);

        RewardRedeemHistoryModel.hasOne(consumers, {
          foreignKey: 'id',
          sourceKey: 'consumer_id'
        });

        RewardRedeemHistoryModel.hasOne(ChannelPartners, {
          foreignKey: 'id',
          sourceKey: 'consumer_id'
        });

        RewardRedeemHistoryModel.hasOne(Reward, {
          foreignKey: 'id',
          sourceKey: 'reward_id'
        });

        RewardRedeemHistoryModel.hasOne(models.LuckyDrawModel, {
          foreignKey: 'id',
          sourceKey: 'scheme_id',
        });

        // {
        //   createdAt: {
        //     [Op.lte]: endDate // Eligible For Reward On The Basis Product Registration
        //   },
        //   createdAt: {
        //     [Op.gte]: startDate
        //   }
        // }
        let redeemedHistoryYY = await RewardRedeemHistoryModel.findAll({
          where: {
            is_luckydraw_reward: luckyDraw,
            [Op.or]: [{ is_verified: 1 }, { is_verified: 2 }],
            [Op.and]: [{ createdAt: { [Op.lte]: endDate } }, { createdAt: { [Op.gte]: startDate } }]
          },
          include: [{
            model: Reward,
            attributes: ['name', 'points', 'is_wallet_based']
          }, {
            model: consumers,
            attributes: ['name']
          },
          {
            model: ChannelPartners,
            attributes: ['name']
          },
          {
            model: models.LuckyDrawModel,
            attributes: ['draw_name']
          },
          ],
          order: [['createdAt', 'DESC']],
          raw: true,
          nest: true
        });

        if (redeemedHistoryYY) {
          redeemedHistory = [...redeemedHistory, ...redeemedHistoryYY];
        }
      }

      console.log("redeemedHistory ka pura data>>>>", redeemedHistory);
      return res.status(200).send({ success: '1', data: redeemedHistory });
    }
    catch (error) {
      console.log("error in reward history", error);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  getRewardsList: async (req, res) => {
    try {
      let luckyDrawList = false;
      if (req.query.for == "ld") {
        luckyDrawList = true;
      }

      await Reward.findAll({
        where: {
          is_luckydraw_reward: luckyDrawList,
          is_deleted: false
        },
        order: [
          ['points', 'ASC'],
        ],
      }).then((rewards) => {
        if (rewards) {
          return res.status(200).send({ success: "1", data: rewards });
        }
        else {
          res.status(200).send({ success: '0', message: "no rewards found" });
        }
      });
    }
    catch (error) {
      logger.error(req, error.message);
      res.status(500).send({ success: '0', message: error.message });
    }
  },
  deleteReward: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors });
      }

      await Reward.findOne({
        where: {
          id: req.query.id
        },
        raw: true,
        attributes: ['id', 'image']
      });

      await Reward.update({
        is_deleted: true
      }, {
        where: {
          id: req.query.id
        }
      }
      );

      // await Reward.destroy({
      //   where: {
      //     id: req.query.id
      //   }
      // });
      return res.status(200).send({ success: '1', message: "deleted" });
    }
    catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message });
    }
  },
  getLuckyDraws: async (req, res) => {
    try {
      let whereClause = {};
      let dateFilter = [];
      if (req.query.startDate) {
        dateFilter.push({ createdAt: { [Op.gte]: moment(req.query.startDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 00:00:00" } });
      }
      if (req.query.endDate) {
        dateFilter.push({ createdAt: { [Op.lte]: moment(req.query.endDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 23:59:59" } });
      }
      if (dateFilter.length > 0) {
        whereClause[Op.and] = dateFilter;
      }
      let lucky_draws = await LuckyDrawModel.findAll({
        where: whereClause,
        include: [{
          model: Reward,
          attributes: ['name']
        }],
        raw: true,
        nest: true
      });
      let data = []
      for (let i = 0; i < lucky_draws.length; i++) {
        let prods = [];
        if (lucky_draws[i].skus.length > 0) {
          prods = await product.findAll({
            where: {
              id: { [Op.in]: lucky_draws[i].skus }
            },
            raw: true,
            attributes: ['sku']
          });
        }
        prods = prods.map(x => x.sku);
        let obj = {
          'id': lucky_draws[i].id,
          'draw_name': lucky_draws[i].draw_name,
          'draw_type': lucky_draws[i].draw_type,
          'consumer_type': lucky_draws[i].consumer_type,
          'lvl_type': lucky_draws[i].lvl_type,
          'no_of_winners': lucky_draws[i].no_of_winners,
          'reward': lucky_draws[i].reward.name,
          'min_scanned_prod': lucky_draws[i].min_scanned_prod,
          'draw_desc': lucky_draws[i].draw_desc,
          'freq_type': lucky_draws[i].freq_type,
          'week_day': lucky_draws[i].week_day,
          'month_date': lucky_draws[i].month_date,
          'start_date': lucky_draws[i].start_date,
          'end_date': lucky_draws[i].end_date,
          'createdAt': lucky_draws[i].createdAt,
          'skus': prods,
          'status': lucky_draws[i].status,
          'esign_status': lucky_draws[i].esign_status,
        }
        data.push(obj);
      }
      return res.status(200).send({ success: '1', data: data })
    }
    catch (error) {
      console.log("error", error);
      logger.error(req, error);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  getLuckyDrawsList: async (req, res) => {
    try {

      let whereClause = {};
      // let whereClause = { is_deleted: false };

      if (req.body.searchForm.startDate) {
        let startDate = req.body.searchForm.startDate;
        let endDate = req.body.searchForm.endDate;

        startDate = moment(startDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 00:00:00";
        endDate = moment(endDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 23:59:59";
        whereClause['createdAt'] = { [Op.between]: [startDate, endDate] };
      }

      if (req.body.searchForm.consumerType) {
        // whereClause['consumer_type'] = req.body.searchForm.consumerType[0].id;
        let consumerObj = req.body.searchForm.consumerType;
        console.log("consumerObj", consumerObj);
        // let consumerType = consumerObj.map(x =>  x.id ); 
        let consumerType = consumerObj[0].id;
        console.log("consumerType", consumerType)
        whereClause['consumer_type'] = consumerType;

        console.log("c type???", req.body.searchForm.consumerType)
      }

      console.log("zones>>>>", req.body.searchForm.zones)
      if (req.body.searchForm.zones) {
        // zone selected
        console.log("zone nhi liye ")
        if (req.body.searchForm.regions) {
          // 
          if (req.body.searchForm.territories) {
            // whereClause['territories']
            // find history id for territories
            let territoryObj = req.body.searchForm.territories;
            let territoryIds = territoryObj.map(x => { return x.id });
            let territoryHistoryIds = await models.territoryMasterModel.findAll({ where: { id: { [Op.in]: territoryIds } }, attributes: ['terriotory_history_id'] });
            let finalHistoryIdsArr = territoryHistoryIds.map(x => { return x.terriotory_history_id });

            console.log("finalHistoryIdsArr", finalHistoryIdsArr);
            whereClause['territories'] = { [Op.overlap]: finalHistoryIdsArr };
          } else {
            // last selection is regions
            // find territories according to selected regions [history id get]
            let regionObj = req.body.searchForm.regions;
            let regionIds = regionObj.map(x => { return x.id });
            let regionHistoryIds = await models.zoneMasterModel.findAll({ where: { id: { [Op.in]: regionIds } }, attributes: ['zone_history_id'] });
            let finalRegionHistoryIdsArr = regionHistoryIds.map(x => { return x.zone_history_id });

            console.log("finalRegionHistoryIdsArr", finalRegionHistoryIdsArr);

            // find all territories which belong in selected regions

            let territoryHistoryIds = await models.territoryMasterModel.findAll({ where: { region_history_id: { [Op.in]: finalRegionHistoryIdsArr } }, attributes: ['terriotory_history_id'] });
            let finalHistoryIdsArr = territoryHistoryIds.map(x => { return x.terriotory_history_id });
            whereClause['territories'] = { [Op.overlap]: finalHistoryIdsArr };
          }
        } else {
          // only zone selected
          // find territories according to selected zones [history ids]
          let zoneObj = req.body.searchForm.zones;
          console.log("zone obj>>>>", zoneObj);
          let zoneIds = zoneObj.map(x => { return x.id });

          console.log("zone ids??????", zoneIds);
          let zoneHistoryIds = await models.parentZoneMasterModel.findAll({ where: { id: { [Op.in]: zoneIds } }, attributes: ['zone_history_id'], raw: true });
          console.log("zoneHistoryIds", zoneHistoryIds)
          let finalZoneHistoryIdsArr = zoneHistoryIds.map(x => { return x.zone_history_id });
          console.log("finalZoneHistoryIdsArr", finalZoneHistoryIdsArr);
          // find all territories which belong in selected regions

          let territoryHistoryIds = await models.territoryMasterModel.findAll({ where: { zone_history_id: { [Op.in]: finalZoneHistoryIdsArr } }, attributes: ['terriotory_history_id'], raw: true });
          console.log("territoryHistoryIds>>>>", territoryHistoryIds);
          let finalHistoryIdsArr = territoryHistoryIds.map(x => { return x.terriotory_history_id });
          console.log("finalHistoryIdsArr>>>>", finalHistoryIdsArr)
          whereClause['territories'] = { [Op.overlap]: finalHistoryIdsArr };
        }
      }

      console.log("whereClause>>>>>>>>", whereClause);



      let lucky_draws = await LuckyDrawModel.findAll({
        where: whereClause,
        include: [{
          model: Reward,
          attributes: ['name']
        }],
        raw: true,
        nest: true
      });

      console.log("lucky_draws>>>", lucky_draws);
      let data = []
      for (let i = 0; i < lucky_draws.length; i++) {
        let prods = [];
        if (lucky_draws[i].skus.length > 0) {
          prods = await product.findAll({
            where: {
              id: { [Op.in]: lucky_draws[i].skus }
            },
            raw: true,
            attributes: ['sku']
          });
        };
        prods = prods.map(x => x.sku);

        if (lucky_draws[i].referance_zones.length > 0) {
          let zone = await models.parentZoneHistoryMasterModels.findAll({ where: { id: { [Op.in]: lucky_draws[i].referance_zones } } })
          if (zone.length > 0) {
            let zoneName = zone.map(x => { return x.name })
            lucky_draws[i].zoneNames = zoneName
          } else {
            lucky_draws[i].zoneNames = []
          }
        }
        else {
          lucky_draws[i].zoneNames = [];
        }

        if (lucky_draws[i].referance_regions.length > 0) {
          let region = await models.zoneHistoryMasterModels.findAll({ where: { id: { [Op.in]: lucky_draws[i].referance_regions } } })
          if (region.length > 0) {
            let regionName = region.map(x => { return x.name })
            lucky_draws[i].regionNames = regionName
          } else {
            lucky_draws[i].regionNames = []
          }
        }
        else {
          lucky_draws[i].regionNames = [];
        }

        if (lucky_draws[i].referance_territories.length > 0) {
          let territories = await models.territoryHistoryMasterModel.findAll({ where: { id: { [Op.in]: lucky_draws[i].referance_territories } } })
          if (territories.length > 0) {
            let territoryNames = territories.map(x => { return x.name })
            lucky_draws[i].territoryNames = territoryNames
          } else {
            lucky_draws[i].territoryNames = []
          }
        }
        else {
          lucky_draws[i].territoryNames = [];
        }


        let obj = {
          'id': lucky_draws[i].id,
          'draw_name': lucky_draws[i].draw_name,
          'draw_type': lucky_draws[i].draw_type,
          'consumer_type': lucky_draws[i].consumer_type,
          'lvl_type': lucky_draws[i].lvl_type,
          'no_of_winners': lucky_draws[i].no_of_winners,
          "currentWinners": lucky_draws[i].allocated_reward,
          'reward': lucky_draws[i].reward.name,
          'min_scanned_prod': lucky_draws[i].min_scanned_prod,
          'draw_desc': lucky_draws[i].draw_desc,
          'freq_type': lucky_draws[i].freq_type,
          'week_day': lucky_draws[i].week_day,
          'month_date': lucky_draws[i].month_date,
          'start_date': lucky_draws[i].start_date,
          'end_date': lucky_draws[i].end_date,
          'createdAt': lucky_draws[i].createdAt,
          'skus': prods,
          'status': lucky_draws[i].status,
          'zoneNames': lucky_draws[i].zoneNames,
          'regionNames': lucky_draws[i].regionNames,
          'territoryNames': lucky_draws[i].territoryNames
        }


        console.log("obj>>>>>>>", obj);

        data.push(obj);
      }
      return res.status(200).send({ success: '1', data: data })
    }
    catch (error) {
      console.log("error", error);
      logger.error(req, error);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  list: async (req, res) => {
    try {
      let whereClause = { is_deleted: false };
      let dateFilter = [];
      if (req.query.skuIds) {
        whereClause['sku_id'] = { [Op.contains]: req.query.skuIds.split(',') };
      }
      if (req.query.startDt) {
        dateFilter.push({ createdAt: { [Op.gte]: moment(req.query.startDt, "YYYY-MM-DD").format("YYYY-MM-DD") + " 00:00:00" } });
      }
      if (req.query.endDt) {
        dateFilter.push({ createdAt: { [Op.lte]: moment(req.query.endDt, "YYYY-MM-DD").format("YYYY-MM-DD") + " 23:59:59" } });
      }
      if (req.query.startDate) {
        dateFilter.push({ createdAt: { [Op.gte]: moment(req.query.startDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 00:00:00" } });
      }
      if (req.query.endDate) {
        dateFilter.push({ createdAt: { [Op.lte]: moment(req.query.endDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 23:59:59" } });
      }
      if (req.query.consumerType) {
        whereClause['consumer_type'] = req.query.consumerType;
      }
      if (dateFilter.length > 0) {
        whereClause[Op.and] = dateFilter;
      }
      if ([18, 19].includes(req.roleId)) {
        let locationDetail = await models.locationModel.findOne({ where: { id: req.locationId }, raw: true });
        if ([18].includes(req.roleId)) {
          whereClause[Op.or] = {
            zones: { [Op.contains]: [locationDetail.zone_id] },
            regions: { [Op.contains]: [locationDetail.region_id] },
            territories: { [Op.contains]: [locationDetail.territory_id] }
          };
        }
        if ([19].includes(req.roleId)) {
          whereClause[Op.or] = {
            zones: { [Op.contains]: [locationDetail.zone_id] },
            regions: { [Op.contains]: [locationDetail.region_id] }
          };
        }
      }
      let point_allocations = await pointAllocation.findAll({
        where: whereClause,
        raw: true,
        nest: true,
        // include: [
        //   {
        //     model: product,
        //     attributes: ['sku', 'id']
        //   }
        // ]
      });
      if (point_allocations.length > 0) {
        for (let i = 0; point_allocations.length > i; i++) {
          console.log(point_allocations[i]);
          let products = await product.findAll({ where: { id: { [Op.in]: point_allocations[i].sku_id } } })
          if (products.length > 0) {
            let skus = products.map(x => { return x.sku })
            point_allocations[i].product = skus
          } else {
            point_allocations[i].product = []
          }
        }
      }
      res.status(200).send({ success: '1', data: point_allocations });
    }
    catch (error) {
      logger.error(req, error.message);
      console.log("err", error);
      return res.status(500).send({ success: '0', message: error.message });
    }
  },
  pointAllocationlist: async (req, res) => {
    try {
      let whereClause = {};

      if (req.body.searchForm?.skus?.length > 0) {
        let skus = req.body.searchForm?.skus.map(x => { return x.id });
        whereClause['sku_id'] = { [Op.overlap]: skus };
      }
      if (req.body.searchForm.startDate) {
        let startDate = req.body.searchForm.startDate;
        let endDate = req.body.searchForm.endDate;

        startDate = moment(startDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 00:00:00";
        endDate = moment(endDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 23:59:59";

        whereClause[Op.or] = [
          {
            // start_date: { [Op.gte]: req.body.searchForm.startDate },
            createdAt: { [Op.between]: [startDate, endDate] },
          },
          {
            type: 2
          },
        ]
      }

      // if (req.body.searchForm.endDate) {
      //   // endTimeWhereClause = {end_date: { [Op.lte]: req.body.searchForm.endDate }}
      //   // whereClause['end_date'] = { [Op.lte]: req.body.searchForm.endDate };

      //   whereClause[Op.or] = [
      //     {

      //       // end_date: { [Op.lte]: req.body.searchForm.endDate },
      //       createdAt: { [Op.lte]: req.body.searchForm.endDate },
      //     },
      //     {
      //       type: 2
      //     },
      //   ]

      // }

      if (req.body.searchForm.consumerType && req.body.searchForm.consumerType.length > 0) {
        // whereClause['consumer_type'] = req.body.searchForm.consumerType[0].id;
        let consumerObj = req.body.searchForm.consumerType;
        console.log("consumerObj", consumerObj);
        // let consumerType = consumerObj.map(x =>  x.id ); 
        let consumerType = consumerObj[0].id;
        console.log("consumerType", consumerType)
        whereClause['consumer_type'] = consumerType;

        console.log("c type???", req.body.searchForm.consumerType)
      }

      console.log("zones>>>>", req.body.searchForm.zones)
      if (req.body.searchForm.zones && req.body.searchForm.zones.length > 0) {
        // zone selected
        console.log("zone nhi liye ")
        if (req.body.searchForm.regions && req.body.searchForm.regions.length > 0) {
          // 
          if (req.body.searchForm.territories && req.body.searchForm.territories.length > 0) {
            // whereClause['territories']
            // find history id for territories
            let territoryObj = req.body.searchForm.territories;
            let territoryIds = territoryObj.map(x => { return x.id });
            let territoryHistoryIds = await models.territoryMasterModel.findAll({ where: { id: { [Op.in]: territoryIds } }, attributes: ['terriotory_history_id'] });
            let finalHistoryIdsArr = territoryHistoryIds.map(x => { return x.terriotory_history_id });

            console.log("finalHistoryIdsArr", finalHistoryIdsArr);
            whereClause['territories'] = { [Op.overlap]: finalHistoryIdsArr };
          } else {
            // last selection is regions
            // find territories according to selected regions [history id get]
            let regionObj = req.body.searchForm.regions;
            let regionIds = regionObj.map(x => { return x.id });
            let regionHistoryIds = await models.zoneMasterModel.findAll({ where: { id: { [Op.in]: regionIds } }, attributes: ['zone_history_id'] });
            let finalRegionHistoryIdsArr = regionHistoryIds.map(x => { return x.zone_history_id });

            console.log("finalRegionHistoryIdsArr", finalRegionHistoryIdsArr);

            // find all territories which belong in selected regions

            let territoryHistoryIds = await models.territoryMasterModel.findAll({ where: { region_history_id: { [Op.in]: finalRegionHistoryIdsArr } }, attributes: ['terriotory_history_id'] });
            let finalHistoryIdsArr = territoryHistoryIds.map(x => { return x.terriotory_history_id });
            whereClause['territories'] = { [Op.overlap]: finalHistoryIdsArr };
          }
        } else {
          // only zone selected
          // find territories according to selected zones [history ids]
          let zoneObj = req.body.searchForm.zones;
          console.log("zone obj>>>>", zoneObj);
          let zoneIds = zoneObj.map(x => { return x.id });

          console.log("zone ids??????", zoneIds);
          let zoneHistoryIds = await models.parentZoneMasterModel.findAll({ where: { id: { [Op.in]: zoneIds } }, attributes: ['zone_history_id'], raw: true });
          console.log("zoneHistoryIds", zoneHistoryIds)
          let finalZoneHistoryIdsArr = zoneHistoryIds.map(x => { return x.zone_history_id });
          console.log("finalZoneHistoryIdsArr", finalZoneHistoryIdsArr);
          // find all territories which belong in selected regions

          let territoryHistoryIds = await models.territoryMasterModel.findAll({ where: { zone_history_id: { [Op.in]: finalZoneHistoryIdsArr } }, attributes: ['terriotory_history_id'], raw: true });
          console.log("territoryHistoryIds>>>>", territoryHistoryIds);
          let finalHistoryIdsArr = territoryHistoryIds.map(x => { return x.terriotory_history_id });
          console.log("finalHistoryIdsArr>>>>", finalHistoryIdsArr)
          whereClause['territories'] = { [Op.overlap]: finalHistoryIdsArr };
        }
      }
      // if ([18, 19].includes(req.roleId)) {
      //   let locationDetail = await models.locationModel.findOne({ where: { id: req.locationId }, raw: true });
      //   if ([18].includes(req.roleId)) {
      //     whereClause[Op.or] = {
      //       zones: { [Op.contains]: [locationDetail.zone_id] },
      //       regions: { [Op.contains]: [locationDetail.region_id] },
      //       territories: { [Op.contains]: [locationDetail.territory_id] }
      //     };
      //   }
      //   if ([19].includes(req.roleId)) {
      //     whereClause[Op.or] = {
      //       zones: { [Op.contains]: [locationDetail.zone_id] },
      //       regions: { [Op.contains]: [locationDetail.region_id] }
      //     };
      //   }
      // }
      let point_allocations = await pointAllocation.findAll({
        where: whereClause,
        raw: true,
        nest: true,
        order: [['createdAt', 'DESC']]
      });
      console.log(point_allocations.length, "lenght");
      if (point_allocations.length > 0) {
        for (let i = 0; point_allocations.length > i; i++) {
          // console.log(point_allocations[i]);
          let products = await product.findAll({ where: { id: { [Op.in]: point_allocations[i].sku_id } } })
          if (products.length > 0) {
            let skus = products.map(x => { return x.sku })
            point_allocations[i].product = skus
          } else {
            point_allocations[i].product = []
          }

          if (point_allocations[i].referance_zones.length > 0) {
            let zone = await models.parentZoneHistoryMasterModels.findAll({ where: { id: { [Op.in]: point_allocations[i].referance_zones } } })
            if (zone.length > 0) {
              let zoneName = zone.map(x => { return x.name })
              point_allocations[i].zoneNames = zoneName
            } else {
              point_allocations[i].zoneNames = []
            }
          }
          else {
            point_allocations[i].zoneNames = [];
          }

          if (point_allocations[i].referance_regions.length > 0) {
            let region = await models.zoneHistoryMasterModels.findAll({ where: { id: { [Op.in]: point_allocations[i].referance_regions } } })
            if (region.length > 0) {
              let regionName = region.map(x => { return x.name })
              point_allocations[i].regionNames = regionName
            } else {
              point_allocations[i].regionNames = []
            }
          }
          else {
            point_allocations[i].regionNames = [];
          }

          if (point_allocations[i].referance_territories.length > 0) {
            let territories = await models.territoryHistoryMasterModel.findAll({ where: { id: { [Op.in]: point_allocations[i].referance_territories } } })
            if (territories.length > 0) {
              let territoryNames = territories.map(x => { return x.name })
              point_allocations[i].territoryNames = territoryNames
            } else {
              point_allocations[i].territoryNames = []
            }
          }
          else {
            point_allocations[i].territoryNames = [];
          }

        }
      }
      res.status(200).send({ success: '1', data: point_allocations });
    }
    catch (error) {
      logger.error(req, error.message);
      console.log("err", error);
      return res.status(500).send({ success: '0', message: error.message });
    }
  },
  getSKUList: async (req, res) => {
    let whereClause = {};
    if (req.query.categoryId) {
      whereClause['category'] = { [Op.in]: req.query.categoryId.split(',') };
    }
    if (req.query.productGroup) {
      whereClause['product_group'] = { [Op.in]: req.query.productGroup.split(',') };
    }
    if (req.query.productRange) {
      whereClause['product_range'] = { [Op.in]: req.query.productRange.split(',') };
    }
    await models.productsModel.findAll({
      where: whereClause,
      attributes: ["name", "id", 'sku', 'category', 'product_group', 'product_range', 'esign_status'],
    })
      .then((resp) => {
        return res.send({ success: 1, data: resp });
      })
      .catch((err) => {
        console.log(err);
        logger.error(req, err.message);
        return res.status(500).send({ code: 0, message: err });
      });
  },
  luckyDrawAdd: async (req, res) => {
    try {
      console.log("req", req.body);
      let validator = new v(req.body, {
        consumer_type: "required",
        draw_type: "required",
        start_date: "required",
        end_date: "required",
        draw_name: "required",
        // no_of_winners: "required",
        // reward_id: "required",
        draw_desc: "required",
        lvl_type: "required",
        termsandconditions: "required",
        reward: "required",
        noOfWinners: "required",
        rewardIds: "required",
        winners: "required",
        // regionId: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res.status(200).send({ success: '0', message: validatorError })
      }
      if (!ValidateFileType(req.files.image)) {
        return res
          .status(200)
          .send({ success: "0", message: "image type not valid" });
      }
      // rewardIds array of object creation
      if (req.body.consumer_type) {
        req.body.consumer_type = JSON.parse(req.body.consumer_type);
      }
      if (req.body.draw_type) {
        req.body.draw_type = JSON.parse(req.body.draw_type);
      }
      if (req.body.zrtType) {
        req.body.zrtType = JSON.parse(req.body.zrtType);
      }
      if (req.body.draw_name) {
        req.body.draw_name = JSON.parse(req.body.draw_name);
      }
      if (req.body.draw_desc) {
        req.body.draw_desc = JSON.parse(req.body.draw_desc);
      }
      if (req.body.start_date) {
        req.body.start_date = JSON.parse(req.body.start_date);
      }
      if (req.body.end_date) {
        req.body.end_date = JSON.parse(req.body.end_date);
      }
      if (req.body.termsandconditions) {
        req.body.termsandconditions = JSON.parse(req.body.termsandconditions);
      }

      if (req.body.rewardIds) {
        req.body.rewardIds = JSON.parse(req.body.rewardIds);
      }
      if (req.body.winners) {
        req.body.winners = JSON.parse(req.body.winners);
      }
      if (req.body.reward) {
        req.body.reward = JSON.parse(req.body.reward);
      }
      if (req.body.noOfWinners) {
        req.body.noOfWinners = JSON.parse(req.body.noOfWinners);
      }
      if (req.body.freq_type) {
        req.body.freq_type = JSON.parse(req.body.freq_type);
      }
      if (req.body.week_day) {
        req.body.week_day = JSON.parse(req.body.week_day);
      }
      if (req.body.month_date) {
        req.body.month_date = JSON.parse(req.body.month_date);
      }


      let rewardWinnersConfig = [];
      if (req.body.reward == null || req.body.reward == undefined) {
        return res.status(200).send({ success: '0', message: "Rewards Should Not Null" });
      }
      if (req.body.noOfWinners == null || req.body.noOfWinners == undefined) {
        return res.status(200).send({ success: '0', message: "Winners Should Not Null" });
      }

      rewardWinnersConfig.push({ reward_id: req.body.reward, no_of_winners: req.body.noOfWinners });

      for (let index = 0; index < req.body.rewardIds.length; index++) {
        const element1 = req.body.rewardIds[index];
        const element2 = req.body.winners[index];
        if (element1.reward == null) {
          return res.status(200).send({ success: '0', message: "Rewards Should Not Null" });
        }
        if (element2.noOfWinners == null) {
          return res.status(200).send({ success: '0', message: "Winners Should Not Null" });
        }
        rewardWinnersConfig.push({ reward_id: element1.reward, no_of_winners: element2.noOfWinners });
      }

      console.log("new rewardWinnersConfig>>>>>>>>>>>>", rewardWinnersConfig);

      let start_date = req.body.start_date;
      let end_date = new Date(req.body.end_date);

      if (end_date <= new Date(start_date)) {
        return res.status(200).send({ success: '0', message: 'End Date Must Be Greater Than Start Date' })
      }
      if (req.body.draw_type == 1) {
        let validator2 = new v(req.body, {
          freq_type: 'required'
        })
        let matched2 = await validator2.check();
        if (!matched2) {
          return res.status(200).send({ success: '0', message: validator2.errors })
        }

        if (req.body.freq_type.type == 1) {
          if (!req.body.week_day) {
            return res.status(200).send({ success: '0', message: 'Week Day is required' })
          }

        }
        if (req.body.freq_type.type == 2) {
          if (!req.body.month_date) {
            return res.status(200).send({ success: '0', message: 'Month Date is required' })
          }
        }
      }

      let date = new Date();
      let luckydrawImage = req.files.image;
      let fileName = date.getTime() + randomstring.generate(10) + path.extname(luckydrawImage.name);
      let params = {
        Bucket: `${global.config.storage.name}/luckydraws`,
        Key: fileName,
        Body: luckydrawImage.data,
        // ContentType: billImage.mimetype,
      }
      let response = await global.s3.upload(params).promise();
      let imgName = response.Location

      let productIdArray = JSON.parse(req.body.req_sku).map(x => x.item_id);
      let batchIdArray = JSON.parse(req.body.productBatch).map(x => x.item_id);
      let categoryIdArray = [];
      if (req.body.category.length > 0) {
        let categoryIdArray1 = JSON.parse(req.body.category);
        if (categoryIdArray1.length > 0) {
          categoryIdArray = categoryIdArray1.map(x => x.item_id);
        }
      }
      let rangeIdArray = [];
      if (req.body.productRange.length > 0 || true) {
        let rangeIdArray1 = JSON.parse(req.body.productRange);
        if (rangeIdArray1.length > 0) {
          rangeIdArray = rangeIdArray1.map(x => x.item_id);
        }
        // rangeIdArray = JSON.parse(req.body.productRange).map(x => x.item_id);
      }
      let groupIdArray = [];
      if (req.body.productGroup.length > 0 || true) {
        let groupIdArray1 = JSON.parse(req.body.productGroup);
        if (groupIdArray1.length > 0) {
          groupIdArray = groupIdArray1.map(x => x.item_id);
        }
        // groupIdArray = JSON.parse(req.body.productGroup).map(x => x.item_id);
      }
      let lvlTypeId = JSON.parse(req.body.lvl_type).map(x => x.item_id);
      // let regionIds = JSON.parse(req.body.regionId).map(x => x.item_id);
      // let zoneIds = JSON.parse(req.body.zoneId).map(x => x.item_id);
      // let territoryIds = JSON.parse(req.body.territoryId).map(x => x.item_id);

      if (['', '""', '[]'].includes(req.body.zoneId)) {
        return res.status(200).send({ success: '0', message: 'Zone Field Is Required' })
      }

      if (['', '""', '[]'].includes(req.body.regionId)) {
        return res.status(200).send({ success: '0', message: 'Region Field Is Required' })
      }

      if (req.body.zrtType == 3 && ['', '""', '[]'].includes(req.body.territoryId)) {
        return res.status(200).send({ success: '0', message: 'Territory Field Is Required' })
      }
      let zoneIds = [];
      if (req.body.zoneId) {
        req.body.zoneId = JSON.parse(req.body.zoneId);
        zoneIds = req.body.zoneId.map(state => state.item_id);
        let zonehistory = await models.parentZoneMasterModel.findAll({ where: { id: { [Op.in]: zoneIds } }, attributes: ['zone_history_id'] });
        zoneIds = zonehistory.map(state => state.zone_history_id);
      }
      let regionIds = []
      if (req.body.regionId) {
        req.body.regionId = JSON.parse(req.body.regionId);
        regionIds = req.body.regionId.map(state => state.item_id);
        let regionHistory = await models.zoneMasterModel.findAll({ where: { id: { [Op.in]: regionIds } }, attributes: ['zone_history_id'] });
        regionIds = regionHistory.map(state => state.zone_history_id);
      }
      let territoryIds = [];
      if (req.body.territoryId) {
        req.body.territoryId = JSON.parse(req.body.territoryId);
        territoryIds = req.body.territoryId.map(state => state.item_id);
        let territoryHistory = await models.territoryMasterModel.findAll({ where: { id: { [Op.in]: territoryIds } }, attributes: ['terriotory_history_id'] });
        territoryIds = territoryHistory.map(state => state.terriotory_history_id);
      }


      let status = 0;
      if (new Date(start_date) <= new Date()) {
        status = 1;
      }
      let currentPointDetails = await models.pointsValuationModel.findOne({ order: [["createdAt", "DESC"]] });

      let LDId = uuid()
      await LuckyDrawModel.create({
        id: LDId,
        consumer_type: req.body.consumer_type,
        draw_type: req.body.draw_type,
        start_date: moment(new Date(start_date)).format('YYYY-MM-DD 00:00:00'),
        // end_date: moment(new Date(end_date)).format('YYYY-MM-DD 00:00:00'),
        // end_date: moment(new Date(end_date)).format('YYYY-MM-DD HH:mm:ss'),
        end_date: end_date,
        draw_name: req.body.draw_name,
        // no_of_winners: req.body.no_of_winners,
        // reward_id: req.body.reward_id,
        draw_desc: req.body.draw_desc,
        min_scanned_prod: req.body.min_scanned,
        freq_type: req.body.freq_type ? req.body.freq_type : null,
        week_day: req.body.week_day ? req.body.week_day : null,
        month_date: req.body.month_date ? req.body.month_date : null,
        // required_sku: req.body.form.required_sku ? req.body.form.required_sku : null,
        lvl_type: lvlTypeId,
        skus: productIdArray,
        status: status,
        image: imgName,
        scheme_image: imgName,
        t_and_c: req.body.termsandconditions,
        category: categoryIdArray.length > 0 ? categoryIdArray[0] : null,
        product_group: groupIdArray.length > 0 ? groupIdArray[0] : null,
        product_range: rangeIdArray.length > 0 ? rangeIdArray[0] : null,
        product_batch: batchIdArray,
        zones: req.body.zrtType == 1 ? zoneIds : [],
        regions: req.body.zrtType == 2 ? regionIds : [],
        territories: req.body.zrtType == 3 ? territoryIds : [],
        referance_zones: zoneIds,
        referance_regions: regionIds,
        referance_territories: territoryIds,
        zrt_type: req.body.zrtType,
        point_valuation_id: currentPointDetails != null ? currentPointDetails.id : null,
        current_valuation: currentPointDetails != null ? currentPointDetails.point : null,
        esign_status: global.config.isEsignBased ? 1 : 2,
        lucky_draw_winners_config: rewardWinnersConfig
      })
      // add schedule the lucky draw
      await rewardController.scheduleLuckyDraws(LDId);
      await rewardController.scheduleLuckyDrawsEnd(LDId);
      return res.status(200).send({ success: '1', message: 'created' })

    }
    catch (error) {
      console.log("error", error);
      logger.error(req, error);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  ChangeStatus: async (req, res) => {
    try {
      let validator = new v(req.body, {
        drawId: 'required',
        status: 'required'
      });
      let matched = await validator.check();
      if (!matched) {
        let ValidatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: '0', message: ValidatorError })
      }
      if (req.body.status != 1 && req.body.status != 2) {
        return res.status(200).send({ success: '0', message: 'invalid status value' })
      }

      let luckyDraw = await LuckyDrawModel.findOne({
        where: {
          id: req.body.drawId
        },
        raw: true
      });
      if (!luckyDraw) {
        return res.status(200).send({ success: '0', message: 'lucky draw not found' })
      }
      if (luckyDraw.status != 1 && luckyDraw.status != 2) {
        return res.status(200).send({ success: '0', message: 'invalid status value' })
      }

      await LuckyDrawModel.update({
        status: req.body.status
      }, {
        where: {
          id: req.body.drawId
        }
      }
      );
      return res.status(200).send({ success: '1', message: 'Status Updated!' });
    }
    catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  rewardAdd: async (req, res) => {
    try {
      let validator = new v(req.body, {
        reward_id: "required",
        name: "required",
        points: "required",
        stock: "required",
        user_type: "required",
        // is_luckydraw_reward:"required"
      });
      let matched = await validator.check();
      if (!matched) {
        if (req.body.is_luckydraw_reward == 'true') {
          let validator2 = new v(req.body, {
            reward_id: "required",
            name: 'required',
            stock: "required"
          });
          let matched2 = await validator2.check();
          if (!matched2) {
            let validatorError = parseValidate(validator2.errors);
            return res.status(200).send({ success: '0', message: validatorError })
          }
        } else {
          let validatorError = parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }
      }
      validator = new v(req.files, {
        image: "required"
      })
      matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: "reward image is required" });
      }

      let rewardID = await Reward.findOne({
        where: { reward_id: req.body.reward_id }
      });
      if (rewardID) {
        return res.status(200).send({ success: '0', message: 'reward id is already exist' })
      }

      if (!ValidateFileType(req.files.image)) {
        return res
          .status(200)
          .send({ success: "0", message: "image type not valid" });
      }

      let date = new Date();
      let rewardImage = req.files.image;
      let fileName = date.getTime() + randomstring.generate(10) + path.extname(rewardImage.name);
      let params = {
        Bucket: `${global.config.storage.name}/rewards`,
        Key: fileName,
        Body: rewardImage.data,
        // ContentType: billImage.mimetype,
      }
      let response = await global.s3.upload(params).promise();
      let imgName = response.Location

      if (req.body.is_luckydraw_reward == 'true') {
        await Reward.create({
          id: uuid(),
          reward_id: req.body.reward_id,
          name: req.body.name,
          stock: req.body.stock,
          image: imgName,
          is_luckydraw_reward: true
        });
      } else if (req.body.is_wallet_based == 'true') {
        console.log("req.body.is_wallet_based>>>>", req.body.is_wallet_based);
        await Reward.create({
          id: uuid(),
          reward_id: req.body.reward_id,
          name: req.body.name,
          points: req.body.points,
          stock: req.body.stock,
          image: imgName,
          user_type: req.body.user_type,
          bonus_points: req.body.bonusPoints,
          is_wallet_based: req.body.is_wallet_based,
          is_luckydraw_reward: false
        });
      }
      else {
        await Reward.create({
          id: uuid(),
          reward_id: req.body.reward_id,
          name: req.body.name,
          points: req.body.points,
          stock: req.body.stock,
          image: imgName,
          user_type: req.body.user_type,
          is_wallet_based: req.body.is_wallet_based,
          is_luckydraw_reward: false
        });
      }
      res.status(200).send({ success: '1', message: "reward added" });
    }
    catch (error) {
      logger.error(req, error.message);
      console.log(">>>>", error.message);
      res.status(500).send({ success: '0', message: error.message });
    }
  },
  editReward: async (req, res) => {
    try {
      console.log("api")
      let validator = new v(req.body, {
        id: "required",
        name: "required",
        stock: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors });
      }

      await Reward.findOne({
        where: {
          id: req.body.id
        },
        raw: true,
        attributes: ['id', 'image']
      });
      let obj = {
        name: req.body.name,
        stock: req.body.stock
      }
      if (req.body.bonusPoints) {
        obj.bonus_points = req.body.bonusPoints
      }
      if (req.body.points) {
        obj.points = req.body.points
      }
      if (req.files != null || req.files != undefined) {
        if (!ValidateFileType(req.files.image)) {
          return res
            .status(200)
            .send({ success: "0", message: "image type is not valid" });
        }

        let date = new Date();
        let rewardImage = req.files.image;
        let fileName = date.getTime() + randomstring.generate(10) + path.extname(rewardImage.name);
        let params = {
          Bucket: `${global.config.storage.name}/rewards`,
          Key: fileName,
          Body: rewardImage.data,
          // ContentType: billImage.mimetype,
        }
        let response = await global.s3.upload(params).promise();
        let imgName = response.Location

        obj.image = imgName;
      }


      let update_status = await Reward.update(obj, {
        where: {
          id: req.body.id
        }
      });
      console.log("status", update_status);
      return res.status(200).send({ success: '1', message: "updated" });
    }
    catch (error) {
      logger.error(req, error.message);
      console.log("error", error);
      res.status(500).send({ success: '0', message: error.message });
    }
  },
  pointAllocationAdd: async (req, res) => {
    console.log(req.body);
    try {
      let validator = new v(req.body, {
        consumer_type: "required|integer",
        sku_id: "required",
        // mode: "required|integer",
        type: "required|integer",
        lvl_type: "required|array",
        zone: "required|array",
        'zone.*.item_id': 'required',
        productBatch: "required"
      })

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: '0', message: validatorError });
      }
      const zoneIds = req.body.zone.map(state => state.item_id);
      const lvlTypeIds = req.body.lvl_type.map(type => type.item_id);
      let skuIds = req.body.sku_id.map(type => type.item_id);
      const batchIds = req.body.productBatch.map(type => type.item_id);
      let categoryIdArray = req.body.category.map(x => x.item_id);
      let rangeIdArray = []
      if (req.body.productRange) {
        rangeIdArray = req.body.productRange.map(x => x.item_id);
      }
      let groupIdArray = []
      if (req.body.productGroup) {
        groupIdArray = req.body.productGroup.map(x => x.item_id);
      }

      let added = await pointAllocation.findAll({
        where: {
          sku_id: { [Op.contains]: skuIds },
          product_batch: { [Op.contains]: batchIds },
          consumer_type: req.body.consumer_type,
          lvl_type: { [Op.contains]: lvlTypeIds },
          is_deleted: false
        },
        raw: true
      });
      if (added.length > 0) {
        for (let i = 0; i < added.length; i++) {
          let alreadyAddedState = await FindAlreadyAddedZones(added[i].zones != null ? added[i].zones : [], zoneIds);
          if (alreadyAddedState != null) {
            return res.status(200).send({ success: '0', message: alreadyAddedState + ' state is already added for this configuration' })
          }
        }
      }

      let scheme_points = [];
      if (req.body.schemesType > 0) {
        if (req.body.extra_points != null) {
          if (req.body.min_scanned == null) {
            return res.status(200).send({ success: '0', message: "Min Scanned Should Not Null" });
          }
          if (req.body.extra_points == null) {
            return res.status(200).send({ success: '0', message: "Extra Points Should Not Null" });
          }
          scheme_points.push({ min_scanned: req.body.min_scanned, extra_points: req.body.extra_points });
        }
        for (let index = 0; index < req.body.extraProducts.length; index++) {
          const element1 = req.body.extraProducts[index];
          const element2 = req.body.extraPoints[index];
          if (element1.min_scanned == null) {
            return res.status(200).send({ success: '0', message: "Min Scanned Should Not Null" });
          }
          if (element2.extra_points == null) {
            return res.status(200).send({ success: '0', message: "Extra Points Should Not Null" });
          }
          scheme_points.push({ min_scanned: element1.min_scanned, extra_points: element2.extra_points });
        }
      }
      scheme_points = scheme_points.sort((a, b) => a.min_scanned - b.min_scanned);

      let obj = {
        id: uuid(),
        consumer_type: req.body.consumer_type,
        sku_id: skuIds,
        mode: req.body.mode,
        lvl_type: lvlTypeIds,
        type: req.body.type,
        product_batch: batchIds,
        category: categoryIdArray.length > 0 ? categoryIdArray[0] : null,
        product_group: groupIdArray.length > 0 ? groupIdArray[0] : null,
        product_range: rangeIdArray.length > 0 ? rangeIdArray[0] : null,
        // min_scanned: req.body.min_scanned,
        // extra_points: req.body.extra_points,
        near_expire_on: req.body.expire_on == '' ? null : req.body.expire_on,
        name: req.body.name,
        scheme_type: req.body.schemesType,
        scheme_points: scheme_points,
        reference_points: req.body.refPoints,
      };
      if (req.body.mode == 1) {
        validator = new v(req.body, {
          percentage: "required"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors)
          return res.status(200).send({ success: '0', message: validatorError });
        }
        if (req.body.percentage > 100 || req.body.percentage <= 0) {
          return res.status(200).send({ success: '0', message: "Percentage should be greater than 0 and less than or equal to 100" })
        }
        obj.mode_points = [{ percentage: req.body.percentage }];
        obj.percentage = req.body.percentage;
      }
      if (req.body.mode == 2) {
        validator = new v(req.body, {
          min: "required|integer",
          max: "required|integer"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }
        if (req.body.min >= req.body.max) {
          return res.status(200).send({ success: '0', message: "Minimum Point should be less than Maximum Point" })
        }
        obj.mode_points = [{ min: req.body.min, max: req.body.max }];
        obj.min = req.body.min;
        obj.max = req.body.max;
      }
      if (req.body.mode == 3) {
        validator = new v(req.body, {
          volumes: "required|numeric",
          volumePoints: "required|integer"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }
        obj.mode_points = [{ volumes: req.body.volumes, volumePoints: req.body.volumePoints }];
      }
      if (req.body.mode == 4) {
        validator = new v(req.body, {
          staticPoints: "required|integer"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }
        obj.mode_points = [{ staticPoints: req.body.staticPoints }];
      }

      if (req.body.type == 1) {
        validator = new v(req.body, {
          start_date: "required",
          end_date: "required"
        })
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }

        let start_date = req.body.start_date.split('/');
        start_date = start_date[1] + "/" + start_date[0] + "/" + start_date[2];
        obj.start_date = new Date(start_date);
        let end_date = req.body.end_date.split('/');
        end_date = end_date[1] + "/" + end_date[0] + "/" + end_date[2];
        obj.end_date = new Date(end_date);
        if (obj.start_date >= obj.end_date) {
          return res.status(200).send({ success: '0', message: "Start Date should be less than End Date" })
        }
      }
      obj.zones = zoneIds;
      await pointAllocation.create(obj);

      return res.status(200).send({ success: '1', message: 'successfully created' });
    }
    catch (error) {
      logger.error(req, error.message);
      console.log("error in adding point allocation", error)
      return res.status(500).send({ success: '0', message: error.message });
    }
  },
  //below function use only for dharmaj 
  pointAllocationBulkAdd: async (req, res) => {
    console.log(req.body);
    try {

      for (const key of Object.keys(req.body)) {
        console.log(">>>>>>>>>>>>>>>key", key, ">>>>>>>>>>>>value", req.body[key]);
        req.body[key] = JSON.parse(req.body[key]);
      }

      let validator = new v(req.body, {
        consumer_type: "required|integer",
        sku_id: "required",
        // mode: "required|integer",
        type: "required|integer",
        lvl_type: "required|array",
        // regionId: "required|array",
        // 'regionId.*.item_id': 'required',
        productBatch: "required",
        refPoints: "required|integer"
      })

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: '0', message: validatorError });
      }
      if (req.body.zrtType == 1 && req.body.zoneId == '' && req.body.hierarchyType == false) {
        return res.status(200).send({ success: '0', message: 'Zone Field Is Required' })
      }

      if (req.body.zrtType == 2 && req.body.regionId == '' && req.body.hierarchyType == false) {
        return res.status(200).send({ success: '0', message: 'Region Field Is Required' })
      }

      if (req.body.zrtType == 3 && req.body.territoryId == '' && req.body.hierarchyType == false) {
        return res.status(200).send({ success: '0', message: 'Territory Field Is Required' })
      }

      if (req.body.locationType == 1 && req.body.status == '' && req.body.hierarchyType == true) {
        return res.status(200).send({ success: '0', message: 'Zone Field Is Required' })
      }

      if (req.body.locationType == 2 && req.body.districts == '' && req.body.hierarchyType == true) {
        return res.status(200).send({ success: '0', message: 'Region Field Is Required' })
      }

      let zoneIds = [];
      if (req.body.zoneId) {
        zoneIds = req.body.zoneId.map(state => state.item_id);
        let zonehistory = await models.parentZoneMasterModel.findAll({ where: { id: { [Op.in]: zoneIds } }, attributes: ['zone_history_id'] });
        zoneIds = zonehistory.map(state => state.zone_history_id);
      }
      let regionIds = []
      if (req.body.regionId) {
        regionIds = req.body.regionId.map(state => state.item_id);
        let regionHistory = await models.zoneMasterModel.findAll({ where: { id: { [Op.in]: regionIds } }, attributes: ['zone_history_id'] });
        regionIds = regionHistory.map(state => state.zone_history_id);
      }
      let teritoryIds = [];
      if (req.body.territoryId && req.body.zrtType == 3) {
        teritoryIds = req.body.territoryId.map(state => state.item_id);
        let territoryHistory = await models.territoryMasterModel.findAll({ where: { id: { [Op.in]: teritoryIds } }, attributes: ['terriotory_history_id'] });
        teritoryIds = territoryHistory.map(state => state.terriotory_history_id);
      }

      let statesIds = [];
      if (req.body.states) {
        statesIds = req.body.states.map(x => x.item_id);
      }
      let districtIds = [];
      if (req.body.districts) {
        districtIds = req.body.districts.map(x => x.item_id);
      }


      let lvlTypeIds = req.body.lvl_type.map(type => type.item_id);

      let rangeIdArray = []
      if (req.body.productRange) {
        rangeIdArray = req.body.productRange.map(x => x.item_id);
      }
      let groupIdArray = []
      if (req.body.productGroup) {
        groupIdArray = req.body.productGroup.map(x => x.item_id);
      }
      let categoryIdArray = [];
      if (req.body.category.length > 0) {
        categoryIdArray = req.body.category.map(x => x.item_id);
      }

      let skuIds;
      if (req.body.schemesType == '5') {
        if (req.body.skuType == '1') {// Product range
          let products = await models.productsModel.findAll({ where: { product_range: { [Op.in]: rangeIdArray } }, raw: true, attributes: ['id'] });
          rangeIdArray = [req.body.list.item_id];
          groupIdArray = [];
          skuIds = products.map(type => type.id);;
        } else if (req.body.skuType == '2') {//Product Group
          let products = await models.productsModel.findAll({ where: { product_group: { [Op.in]: groupIdArray } }, raw: true, attributes: ['id'] });
          rangeIdArray = [];
          groupIdArray = [req.body.list.item_id];
          skuIds = products.map(type => type.id);
        } else if (req.body.skuType == '3') { //skus
          skuIds = req.body.list.map(type => type.item_id);
        } else if (req.body.skuType == '4') { //Product category
          let products = await models.productsModel.findAll({ where: { category: { [Op.in]: categoryIdArray } }, raw: true, attributes: ['id'] });
          rangeIdArray = [];
          groupIdArray = [];
          skuIds = products.map(type => type.id);
        }

      } else {
        skuIds = req.body.sku_id.map(type => type.item_id);
      }
      let batchIds = req.body.productBatch.map(type => type.item_id);
      let products = await models.ProductBatchModel.findAll({ where: { product_id: { [Op.in]: skuIds }, id: { [Op.in]: batchIds } }, group: ['product_id'], attributes: ['product_id'], raw: true });
      skuIds = products.map(type => type.product_id);

      let added = await pointAllocation.findAll({
        where: {
          sku_id: { [Op.overlap]: skuIds },
          product_batch: { [Op.contains]: batchIds },
          consumer_type: req.body.consumer_type,
          lvl_type: { [Op.contains]: lvlTypeIds },
          is_deleted: false
        },
        raw: true
      });

      if (added.length > 0 && req.body.forceAdd == false) {
        for (let i = 0; i < added.length; i++) {
          let addedList = req.body.zrtType == 1 ? added[i].zones : req.body.zrtType == 2 ? added[i].regions : req.body.zrtType == 3 ? added[i].territories : [];
          let alreadyAddedState = await FindAlreadyAddedZones(addedList != null ? addedList : [], regionIds, zoneIds, teritoryIds, req.body.zrtType);
          if (alreadyAddedState != null) {
            return res.status(200).send({ success: '2', message: alreadyAddedState + ' state is already added for this configuration' })
          }
        }
      }
      let scheme_points = [];
      if (req.body.schemesType > 0 && req.body.schemesType != '5') {
        if (true) {
          if (req.body.min_scanned == null || req.body.min_scanned == undefined) {
            return res.status(200).send({ success: '0', message: "Min Scanned Should Not Null" });
          }
          if (req.body.extra_points == null || req.body.extra_points == undefined) {
            return res.status(200).send({ success: '0', message: "Extra Points Should Not Null" });
          }
          scheme_points.push({ min_scanned: req.body.min_scanned, extra_points: req.body.extra_points });
        }
        for (let index = 0; index < req.body.extraProducts.length; index++) {
          const element1 = req.body.extraProducts[index];
          const element2 = req.body.extraPoints[index];
          if (element1.min_scanned == null) {
            return res.status(200).send({ success: '0', message: "Min Scanned Should Not Null" });
          }
          if (element2.extra_points == null) {
            return res.status(200).send({ success: '0', message: "Extra Points Should Not Null" });
          }
          scheme_points.push({ min_scanned: element1.min_scanned, extra_points: element2.extra_points });
        }
      }
      else {
      }
      scheme_points = scheme_points.sort((a, b) => a.min_scanned - b.min_scanned);
      if (req.body.nameInBulk != undefined) {
        req.body.name = req.body.nameInBulk
      }

      if (req.body.schemesType == 5) {
        // obj.mode = '3';
        for (let index = 0; index < req.body.list.length; index++) {
          const element = req.body.list[index];
          scheme_points.push({ volumes: 1, volumePoints: element.point, SkyTypeName: element.item_text, SkuTypeId: element.item_id, skuType: req.body.skuType });
        }
      }
      //sku Type
      //1 - Product Group , 2 - Parent Product Group ,3 - Sku ,4 - Product Category

      let currentPointDetails = await models.pointsValuationModel.findOne({ where: {}, order: [["createdAt", "DESC"]] });

      let obj = {
        id: uuid(),
        consumer_type: req.body.consumer_type,
        sku_id: skuIds,
        mode: req.body.mode,
        lvl_type: lvlTypeIds,
        type: req.body.type,
        product_batch: batchIds,
        category: categoryIdArray.length > 0 ? categoryIdArray[0] : null,
        product_group: groupIdArray.length > 0 ? groupIdArray[0] : null,
        product_range: rangeIdArray.length > 0 ? rangeIdArray[0] : null,
        // min_scanned: req.body.min_scanned,
        // extra_points: req.body.extra_points,
        near_expire_on: req.body.expire_on == '' ? null : req.body.expire_on,
        name: req.body.name,
        scheme_type: req.body.schemesType,
        scheme_points: scheme_points,
        sku_type: req.body.skuType,
        zrt_type: req.body.zrtType,
        point_valuation_id: currentPointDetails != null ? currentPointDetails.id : null,
        current_valuation: currentPointDetails != null ? currentPointDetails.point : null,
        reference_points: req.body.refPoints,
        esign_status: global.config.isEsignBased ? 1 : 2,
        states: statesIds,
        districts: districtIds,
        location_type: req.body.locationType,
        hierarchy_type: req.body.hierarchyType
      };

      if (req.body.mode == 1) {
        validator = new v(req.body, {
          percentage: "required"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors)
          return res.status(200).send({ success: '0', message: validatorError });
        }
        if (req.body.percentage > 100 || req.body.percentage <= 0) {
          return res.status(200).send({ success: '0', message: "Percentage should be greater than 0 and less than or equal to 100" })
        }
        obj.mode_points = [{ percentage: req.body.percentage }];
        obj.percentage = req.body.percentage;
      }
      if (req.body.mode == 2) {
        validator = new v(req.body, {
          min: "required|integer",
          max: "required|integer"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }
        if (req.body.min >= req.body.max) {
          return res.status(200).send({ success: '0', message: "Minimum Point should be less than Maximum Point" })
        }
        obj.mode_points = [{ min: req.body.min, max: req.body.max }];
        obj.min = req.body.min;
        obj.max = req.body.max;
      }
      // if (req.body.mode == 3) {
      //   validator = new v(req.body, {
      //     volumes: "required|numeric",
      //     volumePoints: "required|integer"
      //   });
      //   matched = await validator.check();
      //   if (!matched) {
      //     let validatorError = await parseValidate(validator.errors);
      //     return res.status(200).send({ success: '0', message: validatorError });
      //   }
      //   obj.mode_points = [{ volumes: req.body.volumes, volumePoints: req.body.volumePoints }];
      // }
      if (req.body.mode == 4) {
        validator = new v(req.body, {
          staticPoints: "required|integer"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }
        obj.mode_points = [{ staticPoints: req.body.staticPoints }];
      }

      if (req.body.type == 1) {
        validator = new v(req.body, {
          start_date: "required",
          end_date: "required"
        })
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }

        let start_date = req.body.start_date.split('/');
        start_date = start_date[1] + "/" + start_date[0] + "/" + start_date[2];
        obj.start_date = new Date(start_date);
        let end_date = req.body.end_date.split('/');
        end_date = end_date[1] + "/" + end_date[0] + "/" + end_date[2];
        obj.end_date = new Date(end_date);
        if (obj.start_date >= obj.end_date) {
          return res.status(200).send({ success: '0', message: "Start Date should be less than End Date" })
        }
      }
      obj.zones = req.body.zrtType == 1 ? zoneIds : [];
      obj.regions = req.body.zrtType == 2 ? regionIds : [];
      obj.territories = req.body.zrtType == 3 ? teritoryIds : [];
      obj.referance_zones = zoneIds;
      obj.referance_regions = regionIds;
      obj.referance_territories = teritoryIds;

      let schemeImage = '';
      if (req.files) {
        if (req.files.schemeImage) {
          if (!ValidateFileType(req.files.schemeImage)) {
            return res.status(200).send({ success: "0", message: "Invalid Image" });
          }
          const fileExtension = path.extname(req.files.schemeImage.name);
          const fileName = obj.id + fileExtension
          //----------AWS s3 Image upload------
          let params = {
            Bucket: `${global.config.storage.name}/dharmaj/product-image`,
            Key: fileName,
            Body: req.files.schemeImage.data,
          }
          let response = await global.s3.upload(params).promise();
          schemeImage = response.Location;
        }
      }
      obj.scheme_image = schemeImage;
      await pointAllocation.create(obj);

      return res.status(200).send({ success: '1', message: 'successfully created' });
    }
    catch (error) {
      logger.error(req, error.message);
      console.log("error in adding point allocation", error)
      return res.status(500).send({ success: '0', message: error.message });
    }
  },
  delete: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors });
      }

      await pointAllocation.update({
        is_deleted: true
      }, {
        where: {
          id: req.query.id
        }
      });
      return res.status(200).send({ success: '1', message: "deleted" });
    }
    catch (error) {
      logger.error(req, error.message);
      console.log("error in point all dele", error);
      return res.status(500).send({ success: '0', message: error.message });
    }
  },
  edit: async (req, res) => {
    try {
      let validator = new v(req.body, {
        id: "required",
        sku_id: "required",
        // mode: "required|integer",
        type: "required|integer",
        zone: 'required|array',
        'zone.*.item_id': 'required',
        productBatch: "required",
        refPoints: "required|integer"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: '0', message: validatorError });
      }

      //find current point allocation
      let allocatedPoints = await pointAllocation.findOne({
        where: {
          id: req.body.id
        },
        raw: true
      });
      if (!allocatedPoints) {
        return res.status(200).send({ success: '0', message: 'Not Found' })
      }

      let zoneIds = req.body.zone.map(x => x.item_id);
      let skuIds = req.body.sku_id.map(type => type.item_id);
      let batchIds = req.body.productBatch.map(type => type.item_id);
      let categoryIdArray = req.body.category.map(x => x.item_id);
      let rangeIdArray = req.body.productRange.map(x => x.item_id);
      let groupIdArray = req.body.productGroup.map(x => x.item_id);
      //find same config for other state point allocation
      let allocationForStates = await pointAllocation.findAll({
        where: {
          id: { [Op.ne]: allocatedPoints.id },
          sku_id: { [Op.contains]: skuIds },
          product_batch: { [Op.contains]: batchIds },
          consumer_type: allocatedPoints.consumer_type,
          lvl_type: { [Op.contains]: allocatedPoints.lvl_type },
          // zones: { [Op.contains]: zoneIds },
          is_deleted: false
        },
        raw: true
      })
      //check if state already added for same config
      if (allocationForStates.length >= 0) {
        for (let i = 0; i < allocationForStates.length; i++) {
          let alreadyAddedState = await FindAlreadyAddedZones(allocationForStates[i].zones != null ? allocationForStates[i].zones : [], regionIds, zoneIds, teritoryIds, req.body.zrtType);
          if (alreadyAddedState != null) {
            console.log("in allocated", allocationForStates[i].id, allocatedPoints.id);
            return res.status(200).send({ success: '0', message: alreadyAddedState + ' Already Added For This Configuration' })
          }
        }
      }
      let scheme_points = [];
      if (req.body.schemesType > 0) {
        if (req.body.extra_points != null) {
          if (req.body.min_scanned == null) {
            return res.status(200).send({ success: '0', message: "Min Scanned Should Not Null" });
          }
          if (req.body.extra_points == null) {
            return res.status(200).send({ success: '0', message: "Extra Points Should Not Null" });
          }
          scheme_points.push({ min_scanned: req.body.min_scanned, extra_points: req.body.extra_points });
        }
        else {
          if (req.body.min_scanned == null) {
            return res.status(200).send({ success: '0', message: "Min Scanned Should Not Null" });
          }
          if (req.body.extra_points == null) {
            return res.status(200).send({ success: '0', message: "Extra Points Should Not Null" });
          }
        }
        for (let index = 0; index < req.body.extraProducts.length; index++) {
          const element1 = req.body.extraProducts[index];
          const element2 = req.body.extraPoints[index];
          if (element1.min_scanned == null) {
            return res.status(200).send({ success: '0', message: "Min Scanned Should Not Null" });
          }
          if (element2.extra_points == null) {
            return res.status(200).send({ success: '0', message: "Extra Points Should Not Null" });
          }
          scheme_points.push({ min_scanned: element1.min_scanned, extra_points: element2.extra_points });
        }
      }
      scheme_points = scheme_points.sort((a, b) => a.min_scanned - b.min_scanned);

      let obj = {
        sku_id: skuIds,
        mode: req.body.mode,
        type: req.body.type,
        product_batch: batchIds,
        category: categoryIdArray.length > 0 ? categoryIdArray[0] : [],
        product_group: groupIdArray.length > 0 ? groupIdArray[0] : [],
        product_range: rangeIdArray.length > 0 ? rangeIdArray[0] : [],
        // min_scanned: req.body.min_scanned,
        // extra_points: req.body.extra_points,
        near_expire_on: req.body.expire_on == '' ? null : req.body.expire_on,
        scheme_type: req.body.schemesType,
        scheme_points: scheme_points,
        reference_points: req.body.refPoints,
      };
      if (req.body.mode == 1) {
        validator = new v(req.body, {
          percentage: "required"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors)
          return res.status(200).send({ success: '0', message: validatorError });
        }
        if (req.body.percentage > 100 || req.body.percentage <= 0) {
          return res.status(200).send({ success: '0', message: "Percentage should be greater than 0 and less than or equal to 100" })
        }
        obj.mode_points = [{ percentage: req.body.percentage }];
        obj.percentage = req.body.percentage;
      }
      if (req.body.mode == 2) {
        validator = new v(req.body, {
          min: "required|integer",
          max: "required|integer"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }
        if (req.body.min >= req.body.max) {
          return res.status(200).send({ success: '0', message: "Minimum Point should be less than Maximum Point" })
        }
        obj.mode_points = [{ min: req.body.min, max: req.body.max }];
        obj.min = req.body.min;
        obj.max = req.body.max;
      }
      if (req.body.mode == 3) {
        validator = new v(req.body, {
          volumes: "required|numeric",
          volumePoints: "required|integer"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }
        obj.mode_points = [{ volumes: req.body.volumes, volumePoints: req.body.volumePoints }];
      }
      if (req.body.mode == 4) {
        validator = new v(req.body, {
          staticPoints: "required|integer"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }
        obj.mode_points = [{ staticPoints: req.body.staticPoints }];
      }
      if (req.body.type == 1) {
        validator = new v(req.body, {
          start_date: "required",
          end_date: "required"
        })
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }

        let start_date = req.body.start_date.split('/');
        start_date = start_date[1] + "/" + start_date[0] + "/" + start_date[2];
        obj.start_date = new Date(start_date);

        let end_date = req.body.end_date.split('/');
        end_date = end_date[1] + "/" + end_date[0] + "/" + end_date[2];
        obj.end_date = new Date(end_date);
        if (obj.start_date >= obj.end_date) {
          return res.status(200).send({ success: '0', message: "Start Date should be less than End Date" })
        }
      }
      if (req.body.type == 2) {
        obj.start_date = null;
        obj.end_date = null;
      }
      // obj.zones = zoneIds
      console.log(obj, '???????????????????????????');
      await pointAllocation.update(obj, {
        where: {
          id: req.body.id
        }
      });
      return res.status(200).send({ success: '1', message: "Updated" });

    }
    catch (error) {
      logger.error(req, error.message);
      console.log("error in edit point allocation", error);
      return res.status(500).send({ success: '0', message: error.message });
    }
  },
  newEdit: async (req, res) => {
    try {
      for (const key of Object.keys(req.body)) {
        console.log(">>>>>>>>>>>>>>>key", key, ">>>>>>>>>>>>value", req.body[key]);
        req.body[key] = JSON.parse(req.body[key]);
      }
      let validator = new v(req.body, {
        id: "required",
        sku_id: "required",
        // mode: "required|integer",
        type: "required|integer",
        // zoneId: 'required|array',
        // 'zoneId.*.item_id': 'required',
        productBatch: "required",
        refPoints: "required|integer"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: '0', message: validatorError });
      }

      //find current point allocation
      let allocatedPoints = await pointAllocation.findOne({
        where: {
          id: req.body.id
        },
        raw: true
      });
      if (!allocatedPoints) {
        return res.status(200).send({ success: '0', message: 'Not Found' })
      }
      let zoneIds = [];
      if (req.body.zoneId) {
        zoneIds = req.body.zoneId.map(state => state.item_id);
        let zonehistory = await models.parentZoneMasterModel.findAll({ where: { id: { [Op.in]: zoneIds } }, attributes: ['zone_history_id'] });
        zoneIds = zonehistory.map(state => state.zone_history_id);
      }
      let regionIds = []
      if (req.body.regionId) {
        regionIds = req.body.regionId.map(state => state.item_id);
        let regionHistory = await models.zoneMasterModel.findAll({ where: { id: { [Op.in]: regionIds } }, attributes: ['zone_history_id'] });
        regionIds = regionHistory.map(state => state.zone_history_id);
      }
      let teritoryIds = [];
      if (req.body.territoryId) {
        teritoryIds = req.body.territoryId.map(state => state.item_id);
        let territoryHistory = await models.zoneMasterModel.findAll({ where: { id: { [Op.in]: teritoryIds } }, attributes: ['zone_history_id'] });
        teritoryIds = territoryHistory.map(state => state.terriotory_history_id);
      }
      let skuIds = req.body.sku_id.map(type => type.item_id);
      let products = await models.ProductBatchModel.findAll({ where: { product_id: { [Op.in]: skuIds } }, group: ['product_id'], attributes: ['product_id'], raw: true });
      skuIds = products.map(type => type.product_id);
      const batchIds = req.body.productBatch.map(type => type.item_id);
      // let categoryIdArray = req.body.category.map(x => x.item_id);
      // let rangeIdArray = req.body.productRange.map(x => x.item_id);
      // let groupIdArray = req.body.productGroup.map(x => x.item_id);
      //find same config for other state point allocation
      let allocationForStates = await pointAllocation.findAll({
        where: {
          id: { [Op.ne]: allocatedPoints.id },
          sku_id: { [Op.overlap]: skuIds },
          product_batch: { [Op.contains]: batchIds },
          consumer_type: allocatedPoints.consumer_type,
          lvl_type: { [Op.contains]: allocatedPoints.lvl_type },
          // zones: { [Op.contains]: zoneIds },
          is_deleted: false
        },
        raw: true
      });
      //check if state already added for same config
      if (allocationForStates.length >= 0) {
        for (let i = 0; i < allocationForStates.length; i++) {
          let addedList = req.body.zrtType == 1 ? allocationForStates[i].zones : req.body.zrtType == 2 ? allocationForStates[i].regions : req.body.zrtType == 3 ? allocationForStates[i].territories : [];
          let alreadyAddedState = await FindAlreadyAddedZones(addedList != null ? addedList : [], regionIds, zoneIds, teritoryIds, req.body.zrtType);
          if (alreadyAddedState != null) {
            console.log("in allocated", allocationForStates[i].id, allocatedPoints.id);
            // return res.status(200).send({ success: '2', message: alreadyAddedState + ' Already Added For This Configuration' })
          }
        }
      }
      let scheme_points = [];
      if (req.body.schemesType > 0 && req.body.schemesType != '5') {
        if (true) {
          if (req.body.min_scanned == null || req.body.min_scanned == undefined) {
            return res.status(200).send({ success: '0', message: "Min Scanned Should Not Null" });
          }
          if (req.body.extra_points == null || req.body.extra_points == undefined) {
            return res.status(200).send({ success: '0', message: "Extra Points Should Not Null" });
          }
          scheme_points.push({ min_scanned: req.body.min_scanned, extra_points: req.body.extra_points });
        }
        for (let index = 0; index < req.body.extraProducts.length; index++) {
          const element1 = req.body.extraProducts[index];
          const element2 = req.body.extraPoints[index];
          if (element1.min_scanned == null) {
            return res.status(200).send({ success: '0', message: "Min Scanned Should Not Null" });
          }
          if (element2.extra_points == null) {
            return res.status(200).send({ success: '0', message: "Extra Points Should Not Null" });
          }
          scheme_points.push({ min_scanned: element1.min_scanned, extra_points: element2.extra_points });
        }
      }
      else {
      }
      scheme_points = scheme_points.sort((a, b) => a.min_scanned - b.min_scanned);

      if (req.body.schemesType == 5) {
        // obj.mode = '3';
        for (let index = 0; index < req.body.list.length; index++) {
          const element = req.body.list[index];
          scheme_points.push({ volumes: 1, volumePoints: element.point, SkyTypeName: element.item_text, SkuTypeId: element.item_id, skuType: req.body.skuType });
        }
      }

      let obj = {
        sku_id: skuIds,
        mode: req.body.mode,
        type: req.body.type,
        product_batch: batchIds,
        // category: categoryIdArray.length > 0 ? categoryIdArray[0] : [],
        // product_group: groupIdArray.length > 0 ? groupIdArray[0] : [],
        // product_range: rangeIdArray.length > 0 ? rangeIdArray[0] : [],
        // min_scanned: req.body.min_scanned,
        // extra_points: req.body.extra_points,
        near_expire_on: req.body.expire_on == '' ? null : req.body.expire_on,
        scheme_type: req.body.schemesType,
        scheme_points: scheme_points,
        reference_points: req.body.refPoints,
        esign_status: global.config.isEsignBased ? 1 : 2,
      };


      if (req.body.mode == 1) {
        validator = new v(req.body, {
          percentage: "required"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors)
          return res.status(200).send({ success: '0', message: validatorError });
        }
        if (req.body.percentage > 100 || req.body.percentage <= 0) {
          return res.status(200).send({ success: '0', message: "Percentage should be greater than 0 and less than or equal to 100" })
        }
        obj.mode_points = [{ percentage: req.body.percentage }];
        obj.percentage = req.body.percentage;
      }
      if (req.body.mode == 2) {
        validator = new v(req.body, {
          min: "required|integer",
          max: "required|integer"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }
        if (req.body.min >= req.body.max) {
          return res.status(200).send({ success: '0', message: "Minimum Point should be less than Maximum Point" })
        }
        obj.mode_points = [{ min: req.body.min, max: req.body.max }];
        obj.min = req.body.min;
        obj.max = req.body.max;
      }
      // if (req.body.mode == 3) {
      //   validator = new v(req.body, {
      //     volumes: "required|numeric",
      //     volumePoints: "required|integer"
      //   });
      //   matched = await validator.check();
      //   if (!matched) {
      //     let validatorError = await parseValidate(validator.errors);
      //     return res.status(200).send({ success: '0', message: validatorError });
      //   }
      //   obj.mode_points = [{ volumes: req.body.volumes, volumePoints: req.body.volumePoints }];
      // }
      if (req.body.mode == 4) {
        validator = new v(req.body, {
          staticPoints: "required|integer"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }
        obj.mode_points = [{ staticPoints: req.body.staticPoints }];
      }
      if (req.body.type == 1) {
        validator = new v(req.body, {
          start_date: "required",
          end_date: "required"
        })
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({ success: '0', message: validatorError });
        }

        let start_date = req.body.start_date.split('/');
        start_date = start_date[1] + "/" + start_date[0] + "/" + start_date[2];
        obj.start_date = new Date(start_date);

        let end_date = req.body.end_date.split('/');
        end_date = end_date[1] + "/" + end_date[0] + "/" + end_date[2];
        obj.end_date = new Date(end_date);
        if (obj.start_date >= obj.end_date) {
          return res.status(200).send({ success: '0', message: "Start Date should be less than End Date" })
        }
      }
      if (req.body.type == 2) {
        obj.start_date = null;
        obj.end_date = null;
      }
      let schemeImage = '';
      if (req.files) {
        if (req.files.schemeImage) {
          if (!ValidateFileType(req.files.schemeImage)) {
            return res.status(200).send({ success: "0", message: "Invalid Image" });
          }
          const fileExtension = path.extname(req.files.schemeImage.name);
          const fileName = obj.id + fileExtension
          //----------AWS s3 Image upload------
          let params = {
            Bucket: `${global.config.storage.name}/dharmaj/product-image`,
            Key: fileName,
            Body: req.files.schemeImage.data,
          }
          let response = await global.s3.upload(params).promise();
          schemeImage = response.Location;
        }
      }
      if (req.body.schemeImage) {
        obj.scheme_image = schemeImage;
      }
      // obj.zones = zoneIds
      console.log(obj, '???????????????????????????');
      await pointAllocation.update(obj, {
        where: {
          id: req.body.id
        }
      });
      return res.status(200).send({ success: '1', message: "Updated" });

    }
    catch (error) {
      logger.error(req, error.message);
      console.log("error in edit point allocation", error);
      return res.status(500).send({ success: '0', message: error.message });
    }
  },
  updateRedeemRequests: async (req, res) => {
    console.log("in update claim", req.body);
    try {
      console.log("req.body", req.body)
      let validator = new v(req.body, {
        request_id: "required",
        status: "required",
        consumerId: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({
          success: '0',
          message: validatorError
        })
      }

      if (!req.body.status) {
        validator = new v(req.body, {
          reason: "required"
        });
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({
            success: '0',
            message: validatorError
          })
        }
      }

      if (req.body.status && !req.body.isWalletBased) {
        validator = new v(req.body, {
          partner_name: 'required',
          transaction_id: 'required',
          is_delivered: 'required',
        })
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({
            success: '0',
            message: validatorError
          })
        }
      }

      if (req.body.status && req.body.isWalletBased) {
        validator = new v(req.body, {
          transaction_id: 'required',
          is_delivered: 'required',
        })
        matched = await validator.check();
        if (!matched) {
          let validatorError = await parseValidate(validator.errors);
          return res.status(200).send({
            success: '0',
            message: validatorError
          })
        }
      }

      let luckyDrawRedeemList = false;
      if (req.query.for == "ld") {
        luckyDrawRedeemList = true;
      }

      let startDate = moment(req.query.startDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 00:00:00";
      let endDate = moment(req.query.endDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 23:59:59";

      let startYear = moment(startDate).format('YY');
      let endYear = moment(endDate).format('YY');

      console.log("start year>>>>>", startYear, ">>>>end year>>>>", endYear);

      let availablePoints = 0;
      let userDetails = await consumers.findOne({
        where: {
          id: req.body.consumerId,
          is_deleted: false
        }
      });

      if (!userDetails) {
        userDetails = await ChannelPartners.findOne({
          where: {
            id: req.body.consumerId,
            is_deleted: false
          }
        });
      }

      if (!userDetails) {
        return res.status(200).send({ success: 0, message: 'User Information not Found' });
      }

      availablePoints = userDetails.available_points;
      console.log("available points>>>>", availablePoints);

      let tableUID = userDetails.createdAt;
      tableUID = moment(tableUID).format('YY')
      console.log("curr Year>>>", tableUID);

      let RewardRedeemHistoryModel = await DynamicModels.rewardHistoryModel(tableUID);
      console.log("customModel >>>>>>>>", RewardRedeemHistoryModel);

      RewardRedeemHistoryModel.hasMany(consumers, {
        foreignKey: 'id',
        sourceKey: 'consumer_id'
      })

      RewardRedeemHistoryModel.hasMany(ChannelPartners, {
        foreignKey: 'id',
        sourceKey: 'consumer_id',
      });

      RewardRedeemHistoryModel.hasOne(Reward, {
        foreignKey: 'id',
        sourceKey: 'reward_id',
      });

      let request = await RewardRedeemHistoryModel.findOne({
        where: {
          id: req.body.request_id,
          is_luckydraw_reward: luckyDrawRedeemList,
        },
        raw: true
      });

      if (!request) {
        return res.status(200).send({ success: 0, message: 'Invaild Reward information' });
      }

      console.log("req info>>>>", request);
      console.log("userid>>>>", req.userId);
      let updateStatus;
      let verify = 1;
      if (req.body.status) {
        verify = 2;
        updateStatus = await RewardRedeemHistoryModel.update({
          is_verified: verify,
          partner_name: req.body.partner_name,
          transaction_id: req.body.transaction_id,
          is_delivered: req.body.is_delivered,
          verify_by: req.userId // who approved
        }, {
          where: {
            id: req.body.request_id
          }
        });
      } else {
        updateStatus = await RewardRedeemHistoryModel.update({
          is_verified: verify,
          verify_comments: req.body.reason,
          verify_by: req.userId // who rejected
        }, {
          where: {
            id: req.body.request_id
          }
        });
      }

      if (!updateStatus) {
        return res.status(200).send({ success: 0, message: 'Invaild Request information' });
      }

      console.log("request.reward_id found>>>>>", request.reward_id);
      let reward = await Reward.findOne({
        where: {
          id: request.reward_id
        },
        raw: true
      });

      console.log("reward>>>", reward.id);

      if (!req.body.status && !luckyDrawRedeemList) {
        // lucky draw stock is update using cron
        let rewardStockUpdate = await Reward.update({
          redeemed_stock: Sequelize.literal(`redeemed_stock - 1`)
        }, {
          where: {
            id: request.reward_id
          }
        });

        if (rewardStockUpdate) {
          console.log("updated stock")
        }
        else {
          console.log("not updated");
        }
      }

      let points = reward.points;
      let consumerId = request.consumer_id;
      console.log("points?>>>>", points);
      console.log("consumer_id>>>", consumerId);

      let updatePoints;

      // points only update when reward is not a lucky draw
      if ((reward.is_wallet_based)) {
        if (req.body.status) {
          let multipleTimesPoints = Math.floor(availablePoints / points);
          if (multipleTimesPoints < 0) {
            return res.status(200).send({ success: 0, message: 'Invaild Wallet Points' });
          }
          if ((request.role_id == 0) && (req.body.status)) {
            updatePoints = await consumers.update({
              // available_points: Sequelize.literal(`available_points - ${points}`),
              bonus_points: Sequelize.literal(`bonus_points + ${reward.bonus_points * multipleTimesPoints}`),
            }, {
              where: {
                id: consumerId
              }
            });
          }
          else if ((request.role_id == 1 || request.role_id == 2 || request.role_id == 3) && (req.body.status)) {
            updatePoints = await ChannelPartners.update({
              bonus_points: Sequelize.literal(`bonus_points + ${reward.bonus_points * multipleTimesPoints}`),
            }, {
              where: {
                id: consumerId
              }
            });
          }
        }

      }
      else if ((!luckyDrawRedeemList)) {
        if (req.body.status) {
          console.log("data comes1>>>>", req.body.status)
          if ((request.role_id == 0) && (req.body.status)) {
            updatePoints = await consumers.update({
              // available_points: Sequelize.literal(`available_points - ${points}`),
              blocked_points: Sequelize.literal(`blocked_points - ${points}`),
              utilize_points: Sequelize.literal(`utilize_points + ${points}`),
            }, {
              where: {
                id: consumerId
              }
            });
          } else if ((request.role_id == 1 || request.role_id == 2 || request.role_id == 3) && (req.body.status)) {
            console.log("data comes2>>>>", req.body.status)
            updatePoints = await ChannelPartners.update({
              blocked_points: Sequelize.literal(`blocked_points - ${points}`),
              utilize_points: Sequelize.literal(`utilize_points + ${points}`),
            }, {
              where: {
                id: consumerId
              }
            });
          }
        } else {
          if (request.role_id == 0) {
            console.log("data comes3>>>>", req.body.status)
            updatePoints = await consumers.update({
              available_points: Sequelize.literal(`available_points + ${points}`),
              blocked_points: Sequelize.literal(`blocked_points - ${points}`),
            }, {
              where: {
                id: consumerId
              }
            });
          } else if ((request.role_id == 1 || request.role_id == 2 || request.role_id == 3)) {
            console.log("data comes4>>>>", req.body.status)
            updatePoints = await ChannelPartners.update({
              available_points: Sequelize.literal(`available_points + ${points}`),
              blocked_points: Sequelize.literal(`blocked_points - ${points}`),
            }, {
              where: {
                id: consumerId
              }
            });
          }

          if ((!updatePoints) && (req.body.status)) {
            console.log("Consumer points not updated due to invaild information");
            return res.status(200).send({ success: 0, message: 'Consumer points not updated due to invaild information' });
          }
        }
      }
      // for lucky draw

      console.log("data of joining", userDetails.createdAt);
      let pointsTransactionUID = moment(userDetails.createdAt).format('YY')
      console.log("pointsTransactionUID", pointsTransactionUID);

      let customPointsTransactionModel = await DynamicModels.pointsTransactionModel(pointsTransactionUID);
      console.log("pointsTransactionUID >>>>>>>>", pointsTransactionUID);

      let pointsTransactionName;
      let PointsUpdate = 0;
      if (reward.is_wallet_based) {
        pointsTransactionName = "Wallet Based Scheme";
        PointsUpdate = 0;
      }
      else if (reward.is_luckydraw_reward) {
        pointsTransactionName = "Lucky Draw";
        PointsUpdate = 0;
      }
      else {
        pointsTransactionName = "On Purchase";
        PointsUpdate = reward.points;
      }

      let pointsTransactionData = {
        id: uuid(),
        name: pointsTransactionName, //onsignup, onpurchase, onlucydraw
        type: req.body.status ? 2 : 1, // D/C => 0,1,2 here 2 denotes transaction from block points [blockpoints-- and utilizedpoints ++]
        status: 1, // success,failed,rejected,pending (1 for success)
        reward_id: reward.id,
        // history_id: ,
        customer_id: userDetails.id,
        role_id: userDetails.role_id,
        points: PointsUpdate,
      }

      await customPointsTransactionModel.create(pointsTransactionData);

      return res.status(200).send({
        success: '1',
        message: req.body.status ? "Approved" : "Rejected"
      });
    } catch (error) {
      console.log("Error", error);
      logger.error(req, error.message);
      return res.status(500).send({
        success: '0',
        message: error.message
      })
    }
  },
  detail: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors });
      }
      let details = await pointAllocation.findOne({
        where: { id: req.query.id },
        // include: [{
        //   model: product,
        //   attributes: ['sku', 'id']
        // }],
        raw: true,
        nest: true
      });

      let zoneArray = []
      let zoneWhereClause = {};
      if (details.referance_zones.length != 0) {
        zoneWhereClause.id = { [Op.in]: details.referance_zones };
        let zoneNames = await models.parentZoneHistoryMasterModels.findAll({
          where: zoneWhereClause
        });
        zoneNames.forEach(x => {
          let obj = {
            'item_id': x.zone_id,
            'item_text': x.name
          }
          zoneArray.push(obj)
        })
      }
      details.zones = zoneArray;

      let regionArray = []
      let regionwhereClause = {};
      if (details.referance_regions.length != 0) {
        regionwhereClause.id = { [Op.in]: details.referance_regions };
        let regionNames = await models.zoneHistoryMasterModels.findAll({
          where: regionwhereClause
        });
        regionNames.forEach(x => {
          let obj = {
            'item_id': x.zone_id,
            'item_text': x.name
          }
          regionArray.push(obj)
        })
      }
      details.regions = regionArray;

      let territoryArray = []
      let territorywhereClause = {};
      if (details.referance_territories.length != 0) {
        territorywhereClause.id = { [Op.in]: details.referance_territories };
        let territoryNames = await models.territoryHistoryMasterModel.findAll({
          where: territorywhereClause,
          raw: true
        });
        territoryNames.forEach(x => {
          let obj = {
            'item_id': x.territory_id,
            'item_text': x.name
          }
          territoryArray.push(obj)
        })
      }
      details.territories = territoryArray;

      let products = await product.findAll({
        where: {
          id: { [Op.in]: details.sku_id }
        }
      });
      let productArray = []
      products.forEach(x => {
        let obj = {
          'item_id': x.id,
          'item_text': x.sku
        }
        productArray.push(obj)
      })
      details.product = productArray;

      let productBatchs = await productBatch.findAll({
        where: {
          id: { [Op.in]: details.product_batch }
        }
      });
      let batchArray = []
      productBatchs.forEach(x => {
        let obj = {
          'item_id': x.id,
          'item_text': x.batch_no
        }
        batchArray.push(obj)
      })
      details.batches = batchArray;

      let categoryArray = []
      let productGroupArray = []
      let productRangeArray = []
      let categories = await Category.findOne({
        where: {
          id: details.category
        }
      });
      if (categories) {
        categoryArray.push({
          'item_id': categories.id,
          'item_text': categories.name
        })
      }
      details.category = categoryArray;
      let productGroups = await ProductGroup.findOne({
        where: {
          id: details.product_group
        }
      });
      if (productGroups) {
        productGroupArray.push({
          'item_id': productGroups.id,
          'item_text': productGroups.name
        })
      }
      details.product_group = productGroupArray;
      let productRanges = await ProductRange.findOne({
        where: {
          id: details.product_range
        }
      });
      if (productRanges) {
        productRangeArray.push({
          'item_id': productRanges.id,
          'item_text': productRanges.name
        })
      }
      details.product_range = productRangeArray;
      return res.status(200).send({ success: '1', data: details })
    }
    catch (error) {
      logger.error(req, error.message);
      console.log("error in details point allocation", error);
      return res.status(500).send({ success: '0', message: error.message });
    }

  },
  getBatchByMultipleSku: async (req, res) => {
    try {
      let validator = new v(req.body, {
        skuId: 'required'
      });
      let matched = await validator.check();
      if (!matched) {
        let ValidatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: '0', message: ValidatorError })
      }
      let whereClause = {};
      let locationWhereClause = {};
      let regionIds = [];
      let zoneIds = [];
      let lvls = [];
      if (req.body.regionIds.length > 0) {
        regionIds = req.body.regionIds.map(x => x.item_id);
        locationWhereClause.region_id = { [Op.in]: regionIds };
      }
      if (req.body.zoneIds.length > 0) {
        zoneIds = req.body.zoneIds.map(x => x.item_id);
        locationWhereClause.zone_id = { [Op.in]: zoneIds };
      }
      if (req.body.lvl_type.length > 0) {
        lvls = req.body.lvl_type.map(x => {
          return x.item_id == 1 ? 'P' : x.item_id == 2 ? 'S' : x.item_id == 3 ? 'T' : 'O';
        });
      };
      let locations = await models.locationModel.findAll({
        where: locationWhereClause,
        attributes: ['id'],
        raw: true
      });
      let locationIds = [];
      let availBatchStocks = [];
      let batchIds = [];
      if (locations.length > 0) {
        locationIds = locations.map(x => x.id);
        availBatchStocks = await models.stockSummaryModel.findAll({
          where: {
            location_id: { [Op.in]: locationIds },
            qty: { [Op.gt]: 0 },
            packaging_level: { [Op.in]: lvls }
          },
          attributes: ['batch_id'],
          raw: true
        });
        batchIds = availBatchStocks.map(x => x.batch_id);
      }

      if (req.body.skuId.length > 0) {
        let ids = req.body.skuId.map(x => x.item_id);
        whereClause = {
          id: { [Op.in]: batchIds },
          product_id: {
            [Op.in]: ids
          },

          exp_date: {
            [Op.lte]: req.body.expireDate
          }
        }
      }
      if (batchIds.length == 0) {
        delete whereClause.id;
      }
      if (req.body.expireDate == '') {
        delete whereClause.exp_date;
      }
      let batches = await productBatch.findAll({
        where: whereClause,
        attributes: ['product_id', 'batch_no', 'id'],
        raw: true,
        nest: true
      })
      if (batches.length <= 0) {
        return res.status(200).send({ success: 0, message: 'no data found' });
      }

      return res.status(200).send({ success: 1, data: batches });
    }
    catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  scheduleLuckyDraws: async (LDId) => {
    try {
      console.log("scheduling all available lucky draws for unlock")
      // find all luckydraws
      // 0) Daily
      // 1) Weekly
      // 2) Monthly

      let luckyDraw = await LuckyDrawModel.findOne({
        where: {
          status: 1,
          id: LDId
        },
        raw: true
      });

      console.log("All available lucky draws are>>>>>>>>>>>>>>>>>>", luckyDraw)
      if (luckyDraw) {
        luckyDraw.start_date = new Date(luckyDraw.start_date);
        let executionTime = new Date(luckyDraw.end_date);
        let executionTimeArr = [];
        if (luckyDraw.freq_type == 0) {
          // daily draw
          console.log("Daily draw >>>>>>>>>>>>>>>>>>>>");
          executionTimeArr = await generateDatesUntilEndDate(new Date(luckyDraw.start_date), new Date(luckyDraw.end_date));

        } else if (luckyDraw?.freq_type == 1) {
          // weekly draw
          console.log("Weekly draw >>>>>>>>>>>>>>>>>>");
          executionTimeArr = await generateDatesByDay(new Date(luckyDraw.start_date), new Date(luckyDraw.end_date), luckyDraw.week_day);
        } else if (luckyDraw?.freq_type == 2) {
          // monthly draw
          console.log("Monthly draw");
          executionTimeArr = await generateDatesByDays(new Date(luckyDraw.start_date), new Date(luckyDraw.end_date), luckyDraw.month_date);
        }
        else {
          // one time draw 
          if (luckyDraw?.draw_type == 0) {
            console.log("OneTime draw >>>>>>>>>>>>>>>>>>>>>");
            executionTime = new Date(luckyDraw.end_date);
            executionTimeArr.push(executionTime);
          }

        }

        for (let etpArr of executionTimeArr) {
          let cronExpression = await getCronExpression(etpArr);
          console.log("cronExpression>>>>>>>>>>>>", cronExpression);
          if (new Date(etpArr) < new Date()) {
            // skip this past lucky draw
            console.log("skip>>>>>>>>>>>>>>>>>>>", etpArr)
            continue;
          }

          cron.schedule(cronExpression, () => {
            console.log(`Executing lucky draw: ${luckyDraw.draw_name}`);
            // Write your luckyDraw execution logic here
            console.log(">>>>>>>>>YES I am Working", new Date());
            LuckyDrawControllers.executeLuckyDraw(LDId);
          });
        }
      }
    } catch (err) {
      console.error('Error fetching luckyDraw:', err);
    }
  },
  scheduleLuckyDrawsEnd: async (LId) => {
    try {
      console.log("scheduling all available lucky draws for unlock")
      // find all luckydraws
      // 0) Daily
      // 1) Weekly
      // 2) Monthly

      let luckyDraw = await LuckyDrawModel.findOne({
        where: {
          status: 1,
          id: LId
        },
        raw: true
      });

      console.log("All available lucky draws are>>>>>>>>>>>>>>>>>>", luckyDraw)
      if (luckyDraw) {
        let executionTime = luckyDraw.end_date;
        let cronExpression = await getCronExpression(executionTime);
        console.log("cronExpression>>>>>>>>>>>>", cronExpression);

        console.log("end LD comes");
        cron.schedule(cronExpression, () => {
          console.log(`Executing lucky draw end with 3: ${luckyDraw.end_date}`);
          // Write your luckyDraw execution logic here
          console.log(">>>>>>>>>YES I am Working", new Date());
          console.log("end LD Call");

          rewardController.endLuckyDraw(LId);
        });
      }
    } catch (err) {
      console.error('Error fetching luckyDraw:', err);
    }
  },
  endLuckyDraw: async (LId) => {
    try {

      //End Lucky Draw
      let luckyDrawForStart = await LuckyDrawModel.findOne({
        where: {
          id: LId,
          [Op.or]: [
            { status: 1, }, { status: 2 }],
          esign_status: 2
        },
        raw: true
      })

      if (luckyDrawForStart) {
        await LuckyDrawModel.update({
          status: 3
        }, {
          where: {
            id: LId
          }
        });
      }
    }
    catch (error) {
      logger.error("error in lucky draw update status", error.message);
      console.log("error in luckydraw update status", error);
    }
  },
}

async function getCronExpression(date) {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1; // Months are zero-indexed
  const dayOfWeek = date.getDay();

  return `${minute} ${hour} ${dayOfMonth} ${month} *`;
  // 2 19 29 4 1
}

async function generateDatesUntilEndDate(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(end.getHours());
  start.setMinutes(end.getMinutes());
  start.setSeconds(end.getSeconds());
  start.setMilliseconds(end.getMilliseconds());

  const dates = [];

  // Loop through dates starting from startDate until end date
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    dates.push(new Date(date));
  }

  return dates;
}

async function generateDatesByDay(startDate, endDate, dayValue) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(end.getHours());
  start.setMinutes(end.getMinutes());
  start.setSeconds(end.getSeconds());
  start.setMilliseconds(end.getMilliseconds());

  const dates = [];

  // Loop through dates starting from startDate until end date
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {

    if (date.getDay() === dayValue) {
      dates.push(new Date(date));
    }
  }

  return dates;
}

async function generateDatesByDays(startDate, endDate, day) {
  let start = new Date(startDate);
  let end = new Date(endDate);

  start.setHours(end.getHours());
  start.setMinutes(end.getMinutes());
  start.setSeconds(end.getSeconds());
  start.setMilliseconds(end.getMilliseconds());

  let dates = [];

  console.log("start>>>>>>>>>>", start)
  console.log("end>>>>>>>>>", end)

  let startDateTemp = new Date(start);
  startDateTemp.setDate(day);
  console.log("new start>>>>>>>>>>>", startDateTemp);
  if (startDateTemp >= start) {
    start = startDateTemp;
    console.log("new start1>>>>>>>>>>>", start);
  }
  else if (startDateTemp < start) {
    startDateTemp.setMonth(startDateTemp.getMonth() + 1)
    start = startDateTemp;
    console.log("new start2>>>>>>>>>>>", start);
  }
  // Loop through dates starting from startDate until end date
  for (let date = new Date(start); date <= end; date.setMonth(date.getMonth() + 1)) {
    dates.push(new Date(date));
  }

  return dates;
}

async function FindAlreadyAddedZones(zoneArray, regionsIds, zoneIds = [], teritoryIds = [], ZRTType = 2) {
  let zone = null;
  let defiendZone = ZRTType == 1 ? zoneIds : ZRTType == 2 ? regionsIds : ZRTType == 3 ? teritoryIds : [];
  for (let i = 0; i < zoneArray.length; i++) {
    for (let j = 0; j < defiendZone.length; j++) {
      if (zoneArray[i] == defiendZone[j]) {
        console.log("zone id", zoneArray[i]);
        if (ZRTType == 1) {
          zone = await models.parentZoneMasterModel.findOne({
            where: {
              zone_history_id: zoneArray[i]
            },
            attributes: ['name'],
            raw: true
          });
        } else if (ZRTType == 2) {
          zone = await models.zoneMasterModel.findOne({
            where: {
              zone_history_id: zoneArray[i]
            },
            attributes: ['name'],
            raw: true
          });
        }
        else if (ZRTType == 3) {
          zone = await models.territoryMasterModel.findOne({
            where: {
              terriotory_history_id: zoneArray[i]
            },
            attributes: ['name'],
            raw: true
          });
        }
        break;
      }
    }
  }
  if (zone != null) {
    return zone.name;
  }
  return zone
}

async function FindAlreadyAddedState(stateArray, stateids) {
  let state = null;
  for (let i = 0; i < stateArray.length; i++) {
    for (let j = 0; j < stateids.length; j++) {
      if (stateArray[i] == stateids[j]) {
        console.log("state id", stateArray[i]);
        state = await State.findOne({
          where: {
            id: stateArray[i]
          },
          attributes: ['name'],
          raw: true
        });
        break;
      }
    }
  }
  if (state != null) {
    return state.name;
  }
  return state
}

function ValidateFileType(files) {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
  if (allowedTypes.includes(files.mimetype)) {
    return true;
  }
  return false;
}
//sql query function
async function querySQl(Condition) {
  const data = await db.sequelize.query(Condition, { type: db.Sequelize.QueryTypes.SELECT, raw: true });
  return data.flat();
}

module.exports = rewardController;