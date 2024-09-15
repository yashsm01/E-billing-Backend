const LuckyDrawModel = require("../models").lucky_draws;
const LuckyDrawHistory = require("../models").luckydraw_history;
const scratchCardModel = require("../models").scratch_cards;
const parseValidator = require("../middleware/parseValidate");
const v = require("node-input-validator");
const logger = require("../helpers/logger");
const uuid = require('uuid');
const consumerModel = require("../models").consumers;
const channelPartnerModel = require("../models").channel_partners;
const dealerFirms = require("../models").dealer_firms;
const dealerMobiles = require("../models").dealer_mobileno;
const rewards = require("../models").rewards;
const productReward = require("../models").product_rewards;
const products = require("../models").products;
const city = require("../models").city;
const state = require("../models").state;
const models = require("./_models");
const cron = require('node-cron');

const DynamicModels = require('../models/dynamic_models');

const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const moment = require('moment');

const randomstring = require("randomstring");
const fs = require("fs");
const path = require("path");
const imageDir = path.join("uploads/luckydraws/");

const notificationAdd = require("./../controllers/consumerapi/notifications");

LuckyDrawModel.hasOne(rewards, {
  foreignKey: 'id',
  sourceKey: 'reward_id'
})


const lucky_draw = {
  add: async (req, res) => {
    try {
      let validator = new v(req.body, {
        consumer_type: "required",
        draw_type: "required",
        start_date: "required",
        end_date: "required",
        draw_name: "required",
        no_of_winners: "required",
        reward_id: "required",
        draw_desc: "required",
        lvl_type: "required",
        termsandconditions: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidator(validator.errors);
        return res.status(200).send({ success: '0', message: validatorError })
      }
      if (!ValidateFileType(req.files.image)) {
        return res
          .status(200)
          .send({ success: "0", message: "image type not valid" });
      }

      let start_date = req.body.start_date;
      let end_date = req.body.end_date;

      if (new Date(end_date) <= new Date(start_date)) {
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

      let luckydrawImage = req.files.image;
      let date = new Date();
      let imgName =
        date.getTime() +
        randomstring.generate(10) +
        path.extname(luckydrawImage.name);

      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir);
      }

      luckydrawImage.mv(imageDir + imgName, function (err) {
        if (err) return res.status(500).send({ success: "0", message: err });
      });

      let productIdArray = JSON.parse(req.body.req_sku).map(x => x.item_id);
      await LuckyDrawModel.create({
        id: uuid(),
        consumer_type: req.body.consumer_type,
        draw_type: req.body.draw_type,
        start_date: moment(new Date(start_date)).format('YYYY-MM-DD 00:00:00'),
        end_date: moment(new Date(end_date)).format('YYYY-MM-DD 00:00:00'),
        draw_name: req.body.draw_name,
        no_of_winners: req.body.no_of_winners,
        reward_id: req.body.reward_id,
        draw_desc: req.body.draw_desc,
        min_scanned_prod: req.body.min_scanned,
        freq_type: req.body.freq_type ? req.body.freq_type : null,
        week_day: req.body.week_day ? req.body.week_day : null,
        month_date: req.body.month_date ? req.body.month_date : null,
        // required_sku: req.body.form.required_sku ? req.body.form.required_sku : null,
        lvl_type: req.body.lvl_type,
        skus: productIdArray,
        status: 0,
        image: imgName,
        t_and_c: req.body.termsandconditions
      })

      return res.status(200).send({ success: '1', message: 'created' });

    }
    catch (error) {
      console.log("error", error);
      logger.error(req, error);
      return res.status(500).send({ success: '0', message: error.message });
    }
  },
  getLuckyDraws: async (req, res) => {
    try {
      let lucky_draws = await LuckyDrawModel.findAll({
        include: [{
          model: rewards,
          attributes: ['name']
        }],
        raw: true,
        nest: true
      });
      let data = []
      for (let i = 0; i < lucky_draws.length; i++) {
        let prods = [];
        if (lucky_draws[i].skus.length > 0) {
          prods = await products.findAll({
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
          'status': lucky_draws[i].status
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
  rewardList: async (req, res) => {
    try {
      let reward_list = await rewards.findAll({
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
          model: rewards,
          attributes: ['id', 'name', 'reward_id']
        }],
        raw: true,
        nest: true
      });

      let productSkus = await products.findAll({
        where: {
          id: { [Op.in]: luckyDrawDetail.skus }
        },
        attributes: ['id', 'sku'],
        raw: true
      })
      productSkus = await productSkus.map(x => x.sku);
      luckyDrawDetail.skus = productSkus;
      luckyDrawDetail.image = process.env.SITEURL + "luckydraws/" + luckyDrawDetail.image
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
            model: consumerModel,
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
            let primaryNo = await consumerModel.findOne({
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
  //Update From Admin Panel
  ChangeStatus: async (req, res) => {
    try {
      let validator = new v(req.body, {
        drawId: 'required',
        status: 'required'
      });
      let matched = await validator.check();
      if (!matched) {
        let ValidatorError = await parseValidator(validator.errors);
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
  dailyDraw: async () => {
    try {
      let today = DatewithoutTime(new Date());
      console.log("daily draw today")
      let daily_draws = await models.LuckyDrawModel.findAll({
        where: {
          start_date: {
            [Op.lte]: today
          },
          end_date: {
            [Op.gte]: today
          },
          status: 1,
          freq_type: 0
        },
        raw: true
      });
      console.log("daily draws", daily_draws);
      if (daily_draws.length > 0) {
        for (let i = 0; i < daily_draws.length; i++) {
          let executed = await LuckyDrawHistory.findOne({
            where: {
              draw_id: daily_draws[i].id,
              createdAt: { [Op.eq]: today }
            }
          })
          let reward_details = await rewards.findOne({
            where: {
              id: daily_draws[i].reward_id
            },
            raw: true
          });
          if (!reward_details) {
            return
          }
          if (!executed) {
            let drawUID = moment(daily_draws[i].createdAt).format('MM_YY');
            let luckyDrawUsersModel = await DynamicModels.luckyDrawUsersModel(drawUID);
            let luckydrawUsers = await luckyDrawUsersModel.findAll({
              where: {
                scheme_id: daily_draws[i].id
              },
              raw: true
            });
            // if (luckydrawUsers.length == 0) {
            //   return;
            // }
            let total_scratch_cards = luckydrawUsers;

            // let total_scratch_cards;
            // for (let index = 0; index < luckydrawUsers.length; index++) {
            //   const element = luckydrawUsers[index];
            //   let scratchCardModel = await DynamicModels.scratchCardsModel(element.uid);
            //   let chunk_codes = await scratchCardModel.findAll({
            //     where: {
            //       scheme_id: daily_draws[i].id,
            //       // is_discarded: false,
            //       // is_locked: true
            //     },
            //     raw: true
            //   });
            //   total_scratch_cards.push(...chunk_codes, { uid: element.uid });
            // }

            // let total_scratch_cards_id = total_scratch_cards.map(x => x.id);
            let winners_scratch_cards = [];
            let total_winners = daily_draws[i].no_of_winners;
            if (total_winners > (reward_details.stock - reward_details.redeemed_stock)) {
              total_winners = reward_details.stock - reward_details.redeemed_stock
            }
            if (total_winners < total_scratch_cards.length) {
              shuffle(total_scratch_cards);
              winners_scratch_cards = total_scratch_cards.splice(0, total_winners);
              // winners_scratch_cards = winners_scratch_cards.map(x => x.id);
            }
            else {
              winners_scratch_cards = total_scratch_cards;
              // winners_scratch_cards = winners_scratch_cards.map(x => x.id);
            }
            let uids = [...new Set(luckydrawUsers.map(x => x.uid))];
            for (let index = 0; index < uids.length; index++) {
              const element = uids[index];
              let scratchCardModel = await DynamicModels.scratchCardsModel(element);
              let winner_scratch_cards = luckydrawUsers.filter(x => x.uid == element).map(x => x.id);
              notificationCreate(winner_scratch_cards)
              await scratchCardModel.update({
                is_locked: false,
                reward_id: daily_draws[i].reward_id
              }, {
                where: {
                  id: { [Op.in]: winner_scratch_cards }
                }
              });
            }

            total_winners = winners_scratch_cards.length;
            // await rewards.update({
            //   redeemed_stock: reward_details.redeemed_stock + total_winners
            // }, {
            //   where: {
            //     id: daily_draws[i].reward_id
            //   }
            // })

            // await LuckyDrawModel.update({
            //   status: 2
            // }, {
            //   where: {
            //     id: daily_draws[i].id
            //   }
            // })

            //update total reward distributed Count
            await models.LuckyDrawModel.update({
              allocated_reward: daily_draws[i].allocated_reward + total_winners
            }, {
              where: {
                id: daily_draws[i].id
              }
            });
            //alloted lucky users updated
            await luckyDrawUsersModel.update({
              is_allotted: true
            }, {
              where: {
                scheme_id: daily_draws[i].id
              },
              raw: true
            });

            let history = await LuckyDrawHistory.create({
              id: uuid(),
              draw_id: daily_draws[i].id,
              date: today
            });

            for (let index = 0; index < uids.length; index++) {
              const element = uids[index];
              let scratchCardModel = await DynamicModels.scratchCardsModel(element);
              let total_scratch_cards_id = luckydrawUsers.filter(x => x.uid == element).map(x => x.id);
              await scratchCardModel.update({
                is_locked: false,
                history_id: history.id
              }, {
                where: {
                  id: { [Op.in]: total_scratch_cards_id }
                }
              })
            }
          }
        }
      }
      // return;
    }
    catch (error) {
      console.log("error in daily draw", error);
    }
  },
  weeklyDraw: async () => {
    try {
      let today = DatewithoutTime(new Date());
      let week_day = new Date().getDay();

      let weekly_draws = await LuckyDrawModel.findAll({
        where: {
          start_date: {
            [Op.gt]: today
          },
          end_date: {
            [Op.lte]: today
          },
          status: 1,
          freq_type: 1,
          week_day: week_day
        },
        raw: true
      });
      if (weekly_draws.length > 0) {
        for (let i = 0; i < weekly_draws.length; i++) {
          let executed = await LuckyDrawHistory.findOne({
            where: {
              draw_id: weekly_draws[i].id,
              createdAt: { [Op.eq]: today }
            }
          })
          let reward_details = await rewards.findOne({
            where: {
              id: weekly_draws[i].reward_id
            },
            raw: true
          });
          if (!reward_details) {
            return
          }
          if (!executed) {
            let drawUID = moment(weekly_draws[i].createdAt).format('MM_YY');
            let luckyDrawUsersModel = await DynamicModels.luckyDrawUsersModel(drawUID);
            let luckydrawUsers = await luckyDrawUsersModel.findAll({
              where: {
                scheme_id: weekly_draws[i].id
              },
              raw: true
            });
            // if (luckydrawUsers.length == 0) {
            //   return;
            // }
            let total_scratch_cards = luckydrawUsers;

            // let total_scratch_cards;
            // for (let index = 0; index < luckydrawUsers.length; index++) {
            //   const element = luckydrawUsers[index];
            //   let scratchCardModel = await DynamicModels.scratchCardsModel(element.uid);
            //   let chunk_codes = await scratchCardModel.findAll({
            //     where: {
            //       scheme_id: weekly_draws[i].id,
            //       // is_discarded: false,
            //       // is_locked: true
            //     },
            //     raw: true
            //   });
            //   total_scratch_cards.push(...chunk_codes, { uid: element.uid });
            // }

            // let total_scratch_cards_id = total_scratch_cards.map(x => x.id);
            let winners_scratch_cards = [];
            let total_winners = weekly_draws[i].no_of_winners;
            if (total_winners > (reward_details.stock - reward_details.redeemed_stock)) {
              total_winners = reward_details.stock - reward_details.redeemed_stock
            }
            if (total_winners < total_scratch_cards.length) {
              shuffle(total_scratch_cards);
              winners_scratch_cards = total_scratch_cards.splice(0, total_winners);
              // winners_scratch_cards = winners_scratch_cards.map(x => x.id);
            }
            else {
              winners_scratch_cards = total_scratch_cards;
              // winners_scratch_cards = winners_scratch_cards.map(x => x.id);
            }
            let uids = [...new Set(luckydrawUsers.map(x => x.uid))];
            for (let index = 0; index < uids.length; index++) {
              const element = uids[index];
              let scratchCardModel = await DynamicModels.scratchCardsModel(element);
              let winner_scratch_cards = luckydrawUsers.filter(x => x.uid == element).map(x => x.id);
              notificationCreate(winner_scratch_cards)
              await scratchCardModel.update({
                is_locked: false,
                reward_id: weekly_draws[i].reward_id
              }, {
                where: {
                  id: { [Op.in]: winner_scratch_cards }
                }
              });
            }

            total_winners = winners_scratch_cards.length;
            // await rewards.update({
            //   redeemed_stock: reward_details.redeemed_stock + total_winners
            // }, {
            //   where: {
            //     id: weekly_draws[i].reward_id
            //   }
            // })

            // if (new Date(weekly_draws.end_date).getTime() <= new Date().getTime()) {
            //   await LuckyDrawModel.update({
            //     status: 2
            //   }, {
            //     where: {
            //       id: weekly_draws[i].id
            //     }
            //   })
            // }

            //update total reward distributed Count
            await models.LuckyDrawModel.update({
              allocated_reward: weekly_draws[i].allocated_reward + total_winners
            }, {
              where: {
                id: weekly_draws[i].id
              }
            });
            //alloted lucky users updated
            await luckyDrawUsersModel.update({
              is_allotted: true
            }, {
              where: {
                scheme_id: onetime_draws[i].id
              },
              raw: true
            });

            let history = await LuckyDrawHistory.create({
              id: uuid(),
              draw_id: weekly_draws[i].id,
              date: today
            });

            for (let index = 0; index < uids.length; index++) {
              const element = uids[index];
              let scratchCardModel = await DynamicModels.scratchCardsModel(element);
              let total_scratch_cards_id = luckydrawUsers.filter(x => x.uid == element).map(x => x.id);
              await scratchCardModel.update({
                is_locked: false,
                history_id: history.id
              }, {
                where: {
                  id: { [Op.in]: total_scratch_cards_id }
                }
              })
            }
          }
        }
      }
    } catch (error) {
      console.log("error in weekly draw", error);
    }
  },
  monthlyDraw: async () => {
    try {
      let today = DatewithoutTime(new Date());
      let lastDates = getlastDates(today);
      let monthly_draws = await LuckyDrawModel.findAll({
        where: {
          start_date: {
            [Op.gt]: today
          },
          end_date: {
            [Op.lte]: today
          },
          status: 1,
          freq_type: 2,
          month_date: {
            [Op.in]: lastDates
          }
        },
        raw: true
      });
      if (monthly_draws.length > 0) {
        for (let i = 0; i < monthly_draws.length; i++) {
          let executed = await LuckyDrawHistory.findOne({
            where: {
              draw_id: monthly_draws[i].id,
              createdAt: { [Op.eq]: today }
            }
          })
          let reward_details = await rewards.findOne({
            where: {
              id: monthly_draws[i].reward_id
            },
            raw: true
          });
          if (!reward_details) {
            return
          }
          if (!executed) {
            let drawUID = moment(monthly_draws[i].createdAt).format('MM_YY');
            let luckyDrawUsersModel = await DynamicModels.luckyDrawUsersModel(drawUID);
            let luckydrawUsers = await luckyDrawUsersModel.findAll({
              where: {
                scheme_id: monthly_draws[i].id
              },
              raw: true
            });
            // if (luckydrawUsers.length == 0) {
            //   return;
            // }
            let total_scratch_cards = luckydrawUsers;

            // let total_scratch_cards;
            // for (let index = 0; index < luckydrawUsers.length; index++) {
            //   const element = luckydrawUsers[index];
            //   let scratchCardModel = await DynamicModels.scratchCardsModel(element.uid);
            //   let chunk_codes = await scratchCardModel.findAll({
            //     where: {
            //       scheme_id: monthly_draws[i].id,
            //       // is_discarded: false,
            //       // is_locked: true
            //     },
            //     raw: true
            //   });
            //   total_scratch_cards.push(...chunk_codes, { uid: element.uid });
            // }

            // let total_scratch_cards_id = total_scratch_cards.map(x => x.id);
            let winners_scratch_cards = [];
            let total_winners = monthly_draws[i].no_of_winners;
            if (total_winners > (reward_details.stock - reward_details.redeemed_stock)) {
              total_winners = reward_details.stock - reward_details.redeemed_stock
            }
            if (total_winners < total_scratch_cards.length) {
              shuffle(total_scratch_cards);
              winners_scratch_cards = total_scratch_cards.splice(0, total_winners);
              // winners_scratch_cards = winners_scratch_cards.map(x => x.id);
            }
            else {
              winners_scratch_cards = total_scratch_cards;
              // winners_scratch_cards = winners_scratch_cards.map(x => x.id);
            }
            let uids = [...new Set(luckydrawUsers.map(x => x.uid))];
            for (let index = 0; index < uids.length; index++) {
              const element = uids[index];
              let scratchCardModel = await DynamicModels.scratchCardsModel(element);
              let winner_scratch_cards = luckydrawUsers.filter(x => x.uid == element).map(x => x.id);
              notificationCreate(winner_scratch_cards)
              await scratchCardModel.update({
                is_locked: false,
                reward_id: monthly_draws[i].reward_id
              }, {
                where: {
                  id: { [Op.in]: winner_scratch_cards }
                }
              });
            }
            // await scratchCardModel.update({
            //   is_locked: false,
            //   reward_id: monthly_draws[i].reward_id
            // }, {
            //   where: {
            //     id: { [Op.in]: winners_scratch_cards }
            //   }
            // });

            total_winners = winners_scratch_cards.length;
            // await rewards.update({
            //   redeemed_stock: reward_details.redeemed_stock + total_winners
            // }, {
            //   where: {
            //     id: monthly_draws[i].reward_id
            //   }
            // })

            // await LuckyDrawModel.update({
            //   status: 2
            // }, {
            //   where: {
            //     id: monthly_draws[i].id
            //   }
            // })

            //update total reward distributed Count
            await models.LuckyDrawModel.update({
              allocated_reward: monthly_draws[i].allocated_reward + total_winners
            }, {
              where: {
                id: monthly_draws[i].id
              }
            });
            //alloted lucky users updated
            await luckyDrawUsersModel.update({
              is_allotted: true
            }, {
              where: {
                scheme_id: onetime_draws[i].id
              },
              raw: true
            });

            let history = await LuckyDrawHistory.create({
              id: uuid(),
              draw_id: monthly_draws[i].id,
              date: today
            });

            for (let index = 0; index < uids.length; index++) {
              const element = uids[index];
              let scratchCardModel = await DynamicModels.scratchCardsModel(element);
              let total_scratch_cards_id = luckydrawUsers.filter(x => x.uid == element).map(x => x.id);
              await scratchCardModel.update({
                is_locked: false,
                history_id: history.id
              }, {
                where: {
                  id: { [Op.in]: total_scratch_cards_id }
                }
              })
            }
            // await scratchCardModel.update({
            //   is_locked: false,
            //   history_id: history.id
            // }, {
            //   where: {
            //     id: { [Op.in]: total_scratch_cards_id }
            //   }
            // })

          }
        }
      }
    }
    catch (error) {
      console.log("error in mothly draw", error)
    }
  },
  oneTimeDraw: async () => {
    try {
      // let today = DatewithoutTime(new Date());
      return
      // let today = moment(new Date()).format("YYYY-MM-DD HH:mm:ss");
      let today = moment(new Date('2024-04-30 11:39:00.000 +0530')).format("YYYY-MM-DD HH:mm:ss");
      console.log("today>>>>>>", today);
      console.log("one time LD>>>>>>>>>>>>");
      let onetime_draws = await LuckyDrawModel.findAll({
        where: {
          end_date: {
            [Op.lte]: today
          },
          status: 1,
          draw_type: 0
        },
        raw: true
      });
      if (onetime_draws.length > 0) {
        console.log("onetime_draws list>>>>>>>>>>>>>>>>>>", onetime_draws);
        for (let i = 0; i < onetime_draws.length; i++) {
          let executed = await LuckyDrawHistory.findOne({
            where: {
              draw_id: onetime_draws[i].id,
              createdAt: { [Op.eq]: today }
            }
          })
          // ----------------------------------------------
          // need to update later if rewards are not present in db
          // let reward_details = await rewards.findOne({
          //   where: {
          //     id: onetime_draws[i].reward_id
          //   },
          //   raw: true
          // });
          // if (!reward_details) {
          //   return
          // }
          // --------------------------------------------------
          if (!executed) {
            console.log("execution part of LD>>>>>>>>>>>>");
            let drawUID = moment(onetime_draws[i].createdAt).format('MM_YY');
            let luckyDrawUsersModel = await DynamicModels.luckyDrawUsersModel(drawUID);
            let luckydrawUsers = await luckyDrawUsersModel.findAll({
              where: {
                scheme_id: onetime_draws[i].id
              },
              raw: true
            });

            console.log("luckydrawUsers>>>>>>>>>>>>", luckydrawUsers);
            // if (luckydrawUsers.length == 0) {
            //   return;
            // }
            let total_scratch_cards = luckydrawUsers;

            console.log("total_scratch_cards>>>>>>>>>>", total_scratch_cards);

            let winners_scratch_cards = [];
            let winnerConfig = onetime_draws[i].lucky_draw_winners_config;
            let noOfWinners = 0;
            let uidsForScratchCards = [...new Set(luckydrawUsers.map(x => x.uid))];
            for (let wc of winnerConfig) {
              noOfWinners += wc.no_of_winners;
            }

            console.log("no of the winners>>>>>>>>>>>>>>", noOfWinners);
            // if (noOfWinners > (reward_details.stock - reward_details.redeemed_stock)) {
            //   total_winners = reward_details.stock - reward_details.redeemed_stock
            // }
            if (noOfWinners < total_scratch_cards.length) {
              shuffle(total_scratch_cards);
              winners_scratch_cards = total_scratch_cards.splice(0, noOfWinners); // winner data
            }
            else {
              winners_scratch_cards = total_scratch_cards;
            }

            console.log("winners_scratch_cards>>>>>>>>>>>>>>>>>>>", winners_scratch_cards);
            let winner_scratch_cards = winners_scratch_cards.map(x => x.id);
            let winnersRowIds = [...new Set(winners_scratch_cards.map(x => x.id))];
            let schemeId = onetime_draws[i].id;

            noOfWinners = noOfWinners > winners_scratch_cards.length ? winners_scratch_cards.length : noOfWinners;

            console.log("before>>>>>>>>>>>>>>", winnerConfig);
            winnerConfig.reverse();
            console.log("after>>>>>>>>>>>>>>>", winnerConfig)

            let allocatedIds = [];
            let outFlowReward = [];
            let outFlowCount = [];
            // winnersRowIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
            // winnersRowIds = [1];
            for (let reward of winnerConfig) {
              // let remainingUsers = winnersRowIds - allocatedIds;
              let remainingUsers = winnersRowIds.filter(id => !allocatedIds.includes(id)); // find remaining user

              console.log("remainingUsers>>>>>>>>>>>>>>>>>", remainingUsers);
              // let winners = await findWinnerSuffle(reward.reward_id, nofWinners, remainingUsers)

              let winners;
              if (remainingUsers.length == 0) {
                // all allowcated
                break;
              }
              else if (remainingUsers.length >= reward.no_of_winners) {
                winners = await findWinnerSuffle(reward.reward_id, reward.no_of_winners, remainingUsers);
              } else if (remainingUsers.length < reward.no_of_winners) {
                winners = await findWinnerSuffle(reward.reward_id, remainingUsers.length, remainingUsers);
              }

              console.log("winners>>>>>>>>>>>>>>>>>>>>", winners);

              allocatedIds = [...allocatedIds, ...winners];

              console.log("allowcated ids>>>>>>>>>>>>>>>>>>", allocatedIds)
              // update reward in lucky_user_mm_yy
              outFlowCount = await allowcateReward(winners, reward.reward_id, luckyDrawUsersModel, schemeId);

              // update outflow

              outFlowReward = [...outFlowReward, ...outFlowCount]

              await LuckyDrawModel.update({
                lucky_draw_reward_outflow: outFlowReward,
                allocated_reward: noOfWinners
              }, {
                where: {
                  id: schemeId,
                }
              });


            }

            console.log("outFlowReward>>>>>>>>>>>>", outFlowReward);
            // update winnwers scratch cards
            await updateRewardInScratchCard(luckyDrawUsersModel, schemeId, allocatedIds);

            // unlock rest of users cards 
            await updateScratchCardStatus(uidsForScratchCards, schemeId);
            await updateUnluckyUsers(luckyDrawUsersModel, schemeId)

            return

            // old code

            let uids = [...new Set(winners_scratch_cards.map(x => x.uid))];
            notificationCreate(winner_scratch_cards);

            for (let index = 0; index < uids.length; index++) {
              const element = uids[index];
              let scratchCardModel = await DynamicModels.scratchCardsModel(element);
              // let winner_scratch_cards = luckydrawUsers.filter(x => x.uid == element).map(x => x.id);

              // notificationCreate(winner_scratch_cards);



              // await allowcateRewards(winner_scratch_cards, rewardId, countOfWinners);

              await scratchCardModel.update({
                is_locked: false,
                // reward_id: onetime_draws[i].reward_id
              }, {
                where: {
                  customer_id: { [Op.in]: winner_scratch_cards },
                  schemeId: schemeId,
                  card_type: 2,
                  is_locked: { [Op.ne]: true },
                }
              });

              // ------------
              let winData = await scratchCardModel.findAll({
                where: {
                  id: { [Op.in]: winner_scratch_cards }
                }
              });

              console.log("winData>>>>>>>>>>>>>>>>>", winData);

              // -------------------------
            }


            // -------------OLD


            // let total_winners = onetime_draws[i].no_of_winners;
            // if (total_winners > (reward_details.stock - reward_details.redeemed_stock)) {
            //   total_winners = reward_details.stock - reward_details.redeemed_stock
            // }
            // if (total_winners < total_scratch_cards.length) {
            //   shuffle(total_scratch_cards);
            //   winners_scratch_cards = total_scratch_cards.splice(0, total_winners);
            // }
            // else {
            //   winners_scratch_cards = total_scratch_cards;
            // }

            console.log("winners_scratch_cards>>>>>>>>>>>>>>>>>>>", winners_scratch_cards);
            // let winner_scratch_cards = winners_scratch_cards.map(x => x.id);
            // let uids = [...new Set(luckydrawUsers.map(x => x.uid))];
            // for (let index = 0; index < uids.length; index++) {
            //   const element = uids[index];
            //   let scratchCardModel = await DynamicModels.scratchCardsModel(element);
            //   // let winner_scratch_cards = luckydrawUsers.filter(x => x.uid == element).map(x => x.id);

            //   notificationCreate(winner_scratch_cards)
            //   await scratchCardModel.update({
            //     is_locked: false,
            //     reward_id: onetime_draws[i].reward_id
            //   }, {
            //     where: {
            //       id: { [Op.in]: winner_scratch_cards }
            //     }
            //   });

            //   // ------------
            //   let winData = await scratchCardModel.findAll({
            //     where: {
            //       id: { [Op.in]: winner_scratch_cards }
            //     }
            //   });

            //   console.log("winData>>>>>>>>>>>>>>>>>", winData);

            //   // -------------------------
            // }

            total_winners = winners_scratch_cards.length;
            //update total reward distributed Count
            await models.LuckyDrawModel.update({
              allocated_reward: onetime_draws[i].allocated_reward + total_winners
            }, {
              where: {
                id: onetime_draws[i].id
              }
            });
            //alloted lucky users updated
            await luckyDrawUsersModel.update({
              is_allotted: true
            }, {
              where: {
                scheme_id: onetime_draws[i].id
              },
              raw: true
            });

            let history = await LuckyDrawHistory.create({
              id: uuid(),
              draw_id: onetime_draws[i].id,
              date: today
            });

            for (let index = 0; index < uids.length; index++) {
              const element = uids[index];
              let scratchCardModel = await DynamicModels.scratchCardsModel(element);
              let total_scratch_cards_id = luckydrawUsers.filter(x => x.uid == element).map(x => x.id);
              await scratchCardModel.update({
                is_locked: false,
              }, {
                where: {
                  id: { [Op.in]: total_scratch_cards_id }
                }
              })
            }
          }
        }
      }
    }
    catch (error) {
      console.log("error in onetimedraw", error)
    }

  },

  //Auto Update When Ended
  updateLuckyDrawStatus: async () => {
    try {
      let today = moment(new Date()).format("YYYY-MM-DD 00:00:00");
      // let today = moment(new Date('2024-05-01 03:13:00.000 +0530')).format("YYYY-MM-DD HH:mm:ss");
      //Start lucky draw;
      let luckyDrawForStart = await LuckyDrawModel.findAll({
        where: {
          start_date: {
            [Op.lte]: today
          },
          status: 0,
        },
        raw: true
      })

      let luckyDrawIdsForStart = luckyDrawForStart.map(x => x.id);
      await LuckyDrawModel.update({
        status: 1
      }, {
        where: {
          id: { [Op.in]: luckyDrawIdsForStart }
        }
      });

      //End Lucky Draw
      today = moment(new Date()).format("YYYY-MM-DD HH:mm:ss");
      let luckyDrawsForEnd = await LuckyDrawModel.findAll({
        where: {
          end_date: {
            [Op.lt]: today
          },
          [Op.or]: [
            { status: 1, }, { status: 2 }],
        },
        raw: true
      });
      let luckyDrawsIdsForEnd = luckyDrawsForEnd.map(x => x.id);
      await LuckyDrawModel.update({
        status: 3
      }, {
        where: {
          id: { [Op.in]: luckyDrawsIdsForEnd }
        }
      });

      //Open cards of all ended draws
      // for (let draw of luckyDrawsForEnd) {
      //   openAllCards(draw.id);
      // }
    }
    catch (error) {
      logger.error("error in lucky draw update status", error.message);
      console.log("error in luckydraw update status", error);
    }
  },

  executeLuckyDraw: async (luckyDrawId) => {
    try {
      console.log("Lucky Draw execution>>>>>>>>>>>>", luckyDrawId);
      let currentDraw = await LuckyDrawModel.findOne({
        where: {
          id: luckyDrawId,
          status: 1,
        },
        raw: true
      });
      if (currentDraw) {
        console.log("currentDraw list>>>>>>>>>>>>>>>>>>", currentDraw);

        // ----------------------------------------------
        // need to update later if rewards are not present in db
        // let reward_details = await rewards.findOne({
        //   where: {
        //     id: onetime_draws[i].reward_id
        //   },
        //   raw: true
        // });
        // if (!reward_details) {
        //   return
        // }
        // --------------------------------------------------

        console.log("execution part of LD>>>>>>>>>>>>");
        let drawUID = moment(currentDraw.createdAt).format('MM_YY');
        let luckyDrawUsersModel = await DynamicModels.luckyDrawUsersModel(drawUID);
        let luckydrawUsers = await luckyDrawUsersModel.findAll({
          where: {
            scheme_id: currentDraw.id,
            is_allotted: { [Op.ne]: true },
          },
          raw: true
        });

        console.log("luckydrawUsers>>>>>>>>>>>>", luckydrawUsers);
        // if (luckydrawUsers.length == 0) {
        //   return;
        // }
        let total_scratch_cards = luckydrawUsers;

        console.log("total_scratch_cards>>>>>>>>>>", total_scratch_cards);

        let winners_scratch_cards = [];
        let winnerConfig = currentDraw.lucky_draw_winners_config;
        let noOfWinners = 0;
        let uidsForScratchCards = [...new Set(luckydrawUsers.map(x => x.uid))];
        for (let wc of winnerConfig) {
          noOfWinners += wc.no_of_winners;
        }

        console.log("no of the winners>>>>>>>>>>>>>>", noOfWinners);
        // if (noOfWinners > (reward_details.stock - reward_details.redeemed_stock)) {
        //   total_winners = reward_details.stock - reward_details.redeemed_stock
        // }
        if (noOfWinners < total_scratch_cards.length) {
          shuffle(total_scratch_cards);
          winners_scratch_cards = total_scratch_cards.splice(0, noOfWinners); // winner data
        }
        else {
          winners_scratch_cards = total_scratch_cards;
        }

        console.log("winners_scratch_cards>>>>>>>>>>>>>>>>>>>", winners_scratch_cards);
        let winner_scratch_cards = winners_scratch_cards.map(x => x.id);
        let winnersRowIds = [...new Set(winners_scratch_cards.map(x => x.id))];
        let schemeId = currentDraw.id;

        noOfWinners = noOfWinners > winners_scratch_cards.length ? winners_scratch_cards.length : noOfWinners;

        console.log("before>>>>>>>>>>>>>>", winnerConfig);
        winnerConfig.reverse();
        console.log("after>>>>>>>>>>>>>>>", winnerConfig)

        let allocatedIds = [];
        let outFlowReward = [];
        let outFlowCount = [];
        // winnersRowIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
        // winnersRowIds = [1];
        for (let reward of winnerConfig) {
          // let remainingUsers = winnersRowIds - allocatedIds;
          let remainingUsers = winnersRowIds.filter(id => !allocatedIds.includes(id)); // find remaining user

          console.log("remainingUsers>>>>>>>>>>>>>>>>>", remainingUsers);
          // let winners = await findWinnerSuffle(reward.reward_id, nofWinners, remainingUsers)

          let winners;
          if (remainingUsers.length == 0) {
            // all allowcated
            break;
          }
          else if (remainingUsers.length >= reward.no_of_winners) {
            winners = await findWinnerSuffle(reward.reward_id, reward.no_of_winners, remainingUsers);
          } else if (remainingUsers.length < reward.no_of_winners) {
            winners = await findWinnerSuffle(reward.reward_id, remainingUsers.length, remainingUsers);
          }

          console.log("winners>>>>>>>>>>>>>>>>>>>>", winners);

          allocatedIds = [...allocatedIds, ...winners];

          console.log("allowcated ids>>>>>>>>>>>>>>>>>>", allocatedIds)
          // update reward in lucky_user_mm_yy
          outFlowCount = await allowcateReward(winners, reward.reward_id, luckyDrawUsersModel, schemeId);

          // update outflow

          outFlowReward = [...outFlowReward, ...outFlowCount]

          await LuckyDrawModel.update({
            lucky_draw_reward_outflow: outFlowReward,
            allocated_reward: noOfWinners
          }, {
            where: {
              id: schemeId,
            }
          });


        }

        console.log("outFlowReward>>>>>>>>>>>>", outFlowReward);
        // update winnwers scratch cards
        await updateRewardInScratchCard(luckyDrawUsersModel, schemeId, allocatedIds);

        // unlock rest of users cards 
        await updateScratchCardStatus(uidsForScratchCards, schemeId);
        await updateUnluckyUsers(luckyDrawUsersModel, schemeId)

        return

        // old code

        let history = await LuckyDrawHistory.create({
          id: uuid(),
          draw_id: onetime_draws[i].id,
          date: today
        });

      }
    }
    catch (error) {
      console.log("error in onetimedraw", error)
    }
  },

  scheduleLuckyDraws: async () => {
    try {
      console.log("scheduling all available lucky draws for unlock")
      // find all luckydraws
      // 0) Daily
      // 1) Weekly
      // 2) Monthly

      let luckyDraws = await LuckyDrawModel.findAll({
        where: {
          status: 1
        },
        raw: true
      });

      console.log("All available lucky draws are>>>>>>>>>>>>>>>>>>", luckyDraws)
      if (luckyDraws.length > 0) {
        for (let luckyDraw of luckyDraws) {
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
          } if (luckyDraw?.freq_type == 2) {
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
              lucky_draw.executeLuckyDraw(luckyDraw.id);
            });
          }

        }
      }
    } catch (err) {
      console.error('Error fetching luckyDraw:', err);
    }
  },
  startLuckyDraw: async (LId) => {
    try {
      let luckyDrawForStart = await LuckyDrawModel.findOne({
        where: {
          id: LId,
          status: 0,
          esign_status: 2
        },
        raw: true
      })

      if (luckyDrawForStart) {
        await LuckyDrawModel.update({
          status: 1
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
  startLuckyDraws: async () => {
    try {
      console.log("scheduling all available lucky draws flage 1")
      // find all luckydraws
      // 0) Daily
      // 1) Weekly
      // 2) Monthly

      let luckyDraws = await LuckyDrawModel.findAll({
        where: {
          status: 0,
          esign_status: 2
        },
        raw: true
      });

      console.log("All available lucky draws are>>>>>>>>>>>>>>>>>>", luckyDraws)
      if (luckyDraws.length > 0) {
        for (let luckyDraw of luckyDraws) {
          luckyDraw.start_date = new Date(luckyDraw.start_date);
          let executionTime = new Date(luckyDraw.start_date);

          let cronExpression = await getCronExpression(executionTime);
          console.log("cronExpression>>>>>>>>>>>>", cronExpression);
          if (new Date(executionTime) < new Date()) {
            // skip this past lucky draw
            console.log("skip>>>>>>>>>>>>>>>>>>>", executionTime)
            continue;
          }
          else {
            cron.schedule(cronExpression, () => {
              console.log(`Executing lucky draw: ${luckyDraw.draw_name}`);
              // Write your luckyDraw execution logic here
              console.log(">>>>>>>>>YES I am Working", new Date());
              lucky_draw.startLuckyDraw(luckyDraw.id);
            });
          }
        }
      }
    } catch (err) {
      console.error('Error fetching luckyDraw:', err);
    }
  },
  endLuckyDraws: async () => {
    try {
      console.log("scheduling all available lucky draws flage 3")
      // find all luckydraws
      // 0) Daily
      // 1) Weekly
      // 2) Monthly

      let luckyDraws = await LuckyDrawModel.findAll({
        where: {
          status: 1,
          esign_status: 2
        },
        raw: true
      });

      console.log("All available lucky draws are>>>>>>>>>>>>>>>>>>", luckyDraws)
      if (luckyDraws.length > 0) {
        for (let luckyDraw of luckyDraws) {
          let executionTime = new Date(luckyDraw.end_date);

          let cronExpression = await getCronExpression(executionTime);
          console.log("cronExpression>>>>>>>>>>>>", cronExpression);
          if (new Date(executionTime) < new Date()) {
            // skip this past lucky draw
            console.log("skip>>>>>>>>>>>>>>>>>>>", executionTime)
            continue;
          }
          else {
            cron.schedule(cronExpression, () => {
              console.log(`Executing lucky draw: ${luckyDraw.draw_name}`);
              // Write your luckyDraw execution logic here
              console.log(">>>>>>>>>YES I am Working", new Date());
              lucky_draw.endLuckyDraw(luckyDraw.id);
            });
          }
        }
      }
    } catch (err) {
      console.error('Error fetching luckyDraw:', err);
    }
  }
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

function shuffle(array) {
  var currentIndex = array.length, randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

function DatewithoutTime(dateCurrent) {
  let date = new Date(dateCurrent)
  var todate = date.getDate();
  var tomonth = date.getMonth() + 1;
  var toyear = date.getFullYear();
  var original_date = tomonth + '/' + todate + '/' + toyear;
  let finalDate = new Date(original_date);
  return finalDate;
}

function getlastDates(dateCurrent) {
  let date = new Date();
  let nextDate = new Date();
  nextDate = new Date(nextDate.setDate((nextDate.getDate() + 1)));
  let currentMonth = date.getMonth() + 1;
  let nextMonth = nextDate.getMonth() + 1;
  console.log("date", date);
  console.log("month", currentMonth);
  console.log("next date", nextDate);
  console.log("next month", nextMonth);
  let dateArray = [];

  if (currentMonth != nextMonth) {
    let currentDate = date.getDate();
    while (currentDate <= 31) {
      dateArray.push(currentDate);
      currentDate++;
    }
  } else {
    dateArray.push(date.getDate());
  }
  console.log(">>>", dateArray);
  return dateArray
}

function openAllCards(drawId) {
  scratchCardModel.update({
    is_locked: false
  },
    {
      where: {
        draw_id: drawId,
        is_locked: true,
        is_discarded: false
      }
    }
  );
}

function notificationCreate(winners) {
  for (let i = 0; i < winners.length; i++) {
    notificationAdd.AddNotification(winners[i], 'Unlocked', "Your scratch card is unlocked", 1)
  }
}

function between(min, max) {
  return Math.floor(
    Math.random() * (max - min) + min
  )
}

function ValidateFileType(files) {
  if (files.name.match(/\.(jpg|jpeg|png|gif|PNG|JPG|JPEG)$/)) {
    return true;
  }
  return false;
}

async function findWinnerSuffle(RewardId, noOfWinners, rowIds) {
  let winners = [];

  // suffle function
  console.log("Before suffle>>>>>>>>>>>>>>>>", rowIds);
  shuffle(rowIds);
  winners = rowIds.splice(0, noOfWinners);
  console.log("After suffle>>>>>>>>>>>>>>>>", winners);
  return winners
}

async function allowcateReward(winners, rewardId, luckyDrawUsersModel, schemeId) {
  console.log("update reward id in progress");
  console.log(`${winners} with reward id>>>>>>>>>>> ${rewardId}`);

  let drawInfo = await LuckyDrawModel.findAll({
    where: {
      id: schemeId,
      // status: 1,
      // draw_type: 0
    },
    raw: true,
    nest: true
  });

  // update rewardids
  await luckyDrawUsersModel.update({
    is_allotted: true,
    reward_id: rewardId
  }, {
    where: {
      id: { [Op.in]: winners },
      scheme_id: schemeId,
    }
  });

  // update reward outflow
  let outFlowReward = [];
  outFlowReward.push({ reward_id: rewardId, no_of_winners: winners.length });

  return outFlowReward;
}

async function updateRewardInScratchCard(luckyDrawUsersModel, schemeId, winners) {

  let luckyUsersData = await luckyDrawUsersModel.findAll({
    where: {
      id: { [Op.in]: winners },
      scheme_id: schemeId,
      is_allotted: true
    },
    raw: true,
  });

  if (luckyUsersData.length > 0) {
    for (let luckyUser of luckyUsersData) {
      console.log("luckyUser>>>>>>>>>>>>", luckyUser);
      let userUID = luckyUser.uid;
      let userId = luckyUser.customer_id;
      let rewardId = luckyUser.reward_id;

      let scratchCardModel = await DynamicModels.scratchCardsModel(userUID);

      // update scratch cards
      await scratchCardModel.update({
        is_locked: false,
        reward_id: rewardId,
        is_scratched: true // auto scratch for winners
      }, {
        where: {
          customer_id: userId,
          scheme_id: schemeId,
          card_type: 2
        }
      });
    }

    // send sms for winners
    await luckyDrawSMSForAllParticipate(winners);

  }
  else {
    return;
  }

}

async function updateScratchCardStatus(uids, schemeId) {
  // rest of card unlock is in progress
  for (let index = 0; index < uids.length; index++) {
    const element = uids[index];
    let scratchCardModel = await DynamicModels.scratchCardsModel(element);
    // let total_scratch_cards_id = luckydrawUsers.filter(x => x.uid == element).map(x => x.id);
    await scratchCardModel.update({
      is_locked: false,
    }, {
      where: {
        scheme_id: schemeId,
      }
    })
  }
}

async function updateUnluckyUsers(luckyDrawUsersModel, schemeId) {
  await luckyDrawUsersModel.update({
    is_allotted: true,
    is_scratched: true
  }, {
    where: {
      scheme_id: schemeId,
    }
  });

  // add notification for unlock cards
  let luckyUsersData = await luckyDrawUsersModel.findAll({
    where: {
      scheme_id: schemeId,
      // is_allotted: true
    },
    raw: true,
  });

  // map ids
  let cids = luckyUsersData.map(ld => ld.customer_id);
  notificationCreate(cids);

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

// only for winners
async function luckyDrawSMSForAllParticipate(winners, consumerDetails) {
  try {
    let smsConfig = global.config.otp;
    let smsApiKey = "NzI1YTRhNTg0YTMxNzk0YjM5NmMzODc1MzIzNTM1NzM=";
    console.log("SMS Service in process>>>>>>>>>>>>>>>>>>>>>");
    console.log("Consumer Details :: ", consumerDetails);

    let url = 'https://ttags.in/dgcl';
    for (let winner of winners) {
      // check for farmers
      let consumerDetails = await consumerModel.findOne({
        where: {
          id: winner,
        },
        raw: true
      });

      if (!consumerDetails) {
        // check for channel partners
        consumerDetails = await channelPartnerModel.findOne({
          where: {
            id: winner,
          },
          raw: true
        });
      }

      if (consumerDetails) {
        let response = await axios.get(`https://api.textlocal.in/send/?apikey=${smsApiKey}=&numbers=${consumerDetails.phone}&sender=${smsConfig.sender}&custom=${smsConfig.custom}&message=Congratulations! You have won an exciting prize in lucky draw for purchasing a genuine product ${url} - VIVIDE`);
      }
      else {
        console.log("SMS not sent due to user not found ::::::::", winner);
      }

    }

    // let response = await axios.get('https://api.textlocal.in/send/?apikey=NzI1YTRhNTg0YTMxNzk0YjM5NmMzODc1MzIzNTM1NzM=&numbers=' + consumerDetails.phone + '&sender=VIVIDE&message=Congratulations!! You are one of the winners of Dabur Real SIP & WIN contest. Shortly our representative will call you. Please be available to confirm the address. Thank You! ' + url + '');
    // console.log("SMS Service Response :: ", response);
    // console.log(url);


  } catch (ex) {
    console.error(ex);
    logger.error(req, ex.message);
    return res.status(500).json({
      success: false,
      error: ex.message
    });
  }
}

module.exports = lucky_draw;
