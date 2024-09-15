const v = require('node-input-validator');
const uuid = require('uuid');
const jwt = require('jsonwebtoken');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const randomstring = require('randomstring');
const otpGenerator = require('otp-generator');
const axios = require('axios');
const crypto = require('crypto');
const CryptoJS = require("crypto-js");
const password = process.env['CRYPT_PASSWORD'];
const iv = Buffer.from(process.env['IV']);
const ivstring = iv.toString('hex').slice(0, 16);
const logger = require('../helpers/logger');
const parseValidate = require("../middleware/parseValidate");
const consumers = require("../models/").consumers;
const ConsumerModel = require("../models/").consumers;
const secondaryConsumers = require("../models/").dealer_mobileno;
const CustomerProduct = require('../models/').customer_products;
const CustomerScanHistory = require('../models/').customer_scan_history;
const Product = require('../models/').products;
const CustomerReviews = require("../models/").customer_reviews;
const LuckyDraws = require("../models/").lucky_draws;
const PointAllocation = require("../models/").point_allocation;
const ProductWarranties = require('../models/').product_warranties;
const ProductAuthentication = require('../models/').product_authentications;
const Transactions = require('../models/').redeem_points_transactions;
const ProductCategory = require("../models/").categories;
// const CompanyBrands = require("../models/").companies;
const City = require('../models').city;
const CompanyUser = require('../models/').company_users;
const RewardRedeemHistoryData = require('../models').reward_redeem_history;
const Reward = require('../models').rewards;
const Transaction = require("../models").redeem_points_transactions;
const ProductOffer = require("../models/").product_offers;
// const ScratchCardModel = require("../models").scratch_cards;
const rewards = require("../models").rewards;
const LocationModel = require("../models").locations;
const DynamicModels = require('../models/dynamic_models');
const LocationTracker = require('../helpers/customer-location-tracker');

const notificationController = require('./../controllers/consumerapi/notifications')

const Pincodes = require('../models/').pincodes;
const DynamicUIDModel = require('../models/').dynamic_uids;
const DynamicLevelCodesModel = require('../models/').dynamic_level_codes
const ChannelPartners = require("../models").channel_partners;
const models = require("./_models");
const { rewardHistoryRequired } = require('../i18n/en');
const commonController = require('./common');
const counterfit = require('../models/counterfit');
Product.hasOne(ProductCategory, {
  foreignKey: "id",
  sourceKey: "category",
  as: "categories"
})

let consumerController = {

  getStateAndCityId: async (req, res) => {
    try {
      console.log("api hit")
      let validator = new v(req.query, {
        pincode: 'required'
      })
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate((validator.errors))
        return res.status(200).send({ success: '0', message: validatorError })
      }

      const pincodeInfo = await Pincodes.findOne({
        where: {
          pincode: req.query.pincode,
        },
        raw: true
      });
      if (!pincodeInfo) {
        return res.status(200).send({ success: '0', message: 'Invalid pincode' })
      }
      console.log("pincode info found>>>>>", pincodeInfo);
      return res.status(200).send({
        success: 1,
        data: pincodeInfo,
      });
    } catch (ex) {
      console.log("error in finding state and city id", ex);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
  scanCode: async (req, res) => {
    try {
      // req.query.unique_code = 'https://wcpl.trusttags.in/01/810000893/10/WL24ITB041/21/LELPUMV2JMCEA?11=240330&17=260329';
      let validator = new v(req.query, {
        unique_code: 'required'
      })
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate((validator.errors))
        return res.status(200).send({ success: '0', message: validatorError })
      }

      console.log("req.query.unique_code >>>>>", req.query.unique_code);
      let UIDAndLevel = await getUIDAndLevel(req.query.unique_code);

      console.log("UIDAndLevel >>>>>> ", UIDAndLevel);
      let level = UIDAndLevel.level;
      let uid = UIDAndLevel.UID;

      console.log("level :: ", level);
      console.log("UID :: ", uid);

      let key = level;
      let UID = uid;

      let CustomModel = await getDynamicModel(key, UID); // outer_qrcodes_1am

      //Find in trusted qrcode table
      let codeDetail;
      codeDetail = await CustomModel.findOne({
        where: {
          unique_code: req.query.unique_code,
        },
        raw: true,
        include: [
          {
            model: models.productsModel,
            as: 'product',
            raw: true,
            include: [{
              model: models.customerCareModel,
              as: 'customer_care',
              raw: true
            }]
          },

          {
            model: models.ProductBatchModel,
            as: 'product_batch',
            raw: true,
            include: [
              {
                model: LocationModel,
                raw: true
              }
            ]
          },
        ],

        raw: true,
        nest: true
      })
      if (!codeDetail) {
        return res.status(200).send({ success: '0', message: 'Invalid Code' })
      }
      codeDetail.thirdParty = false;
      let codeDetailReplaced;
      if (codeDetail.replaced_from) {
        let productDetail = await models.productsModel.findOne({ where: { id: codeDetail.assigned_product_id }, raw: true });
        CustomModel = await getDynamicModel(key, productDetail.u_id); // outer_qrcodes_1am

        codeDetailReplaced = await CustomModel.findOne({
          where: {
            unique_code: codeDetail.replaced_from,
          },
          raw: true,
          include: [
            {
              model: models.productsModel,
              as: 'product',
              raw: true,
              include: [{
                model: models.customerCareModel,
                as: 'customer_care',
                raw: true
              }]
            },

            {
              model: models.ProductBatchModel,
              as: 'product_batch',
              raw: true,
              include: [
                {
                  model: LocationModel,
                  raw: true
                }
              ]
            },
          ],

          raw: true,
          nest: true
        })
        if (!codeDetailReplaced) {
          return res.status(200).send({ success: '0', message: 'Invalid Code' })
        }
        codeDetailReplaced.storage_bin_id = codeDetail.storage_bin_id;
        codeDetail = codeDetailReplaced;
      }


      let isGeneral = codeDetail.is_general;
      let codeLevel = level;
      let parent = [];
      let childs = []

      let codeFound = codeDetail;
      console.log("11111111");
      if (!codeFound.is_replaced) {
        console.log("222222222");
        if (codeFound.is_mapped) {
          console.log("33333333333");
          let masterInfo = !isGeneral ? codeFound.product_batch : codeFound.assigned_batch;
          let ParentLvl = await parentLvl(codeLevel, masterInfo);
          // let ParentLvl = codeFound.parent_level;
          if (ParentLvl != null) {
            console.log("44444444444");
            let ParentModel = await getDynamicModel(ParentLvl, !isGeneral ? codeFound.product.u_id : codeFound.assigned_product.u_id);
            if (!ParentModel) {
              console.log('Dynamic Parent Model Not Found');
              // return res.status(200).send({ success: 0, message: 'Dynamic Parent Model Not Found' })
            }
            else {
              let parentCode = await ParentModel.findOne({
                where: {
                  id: codeFound.mapped_to_parent
                },
                raw: true
              })
              if (!parentCode) {
                return res.status(200).send({ success: 0, message: 'Parent Code Not Found' })
              }
              parent.push({ unique_code: parentCode.unique_code, qr_code: parentCode.qr_code })
            }
          }

        }

        if (codeFound.is_complete || true) {
          let innerLevel;
          // let currentProductInfo = !isGeneral ? codeFound.product : codeFound.assigned_product;
          let masterInfo = !isGeneral ? codeFound.product_batch : codeFound.assigned_batch;
          if (codeLevel == 'S') {
            if (masterInfo.is_mapp_primary) {
              innerLevel = 'P';
            }
          }
          else if (codeLevel == 'T') {
            if (masterInfo.is_mapp_secondary) {
              innerLevel = 'S';
            }
            else if (masterInfo.is_mapp_primary) {
              innerLevel = 'P'
            }
          }
          else if (codeLevel == 'O') {
            if (masterInfo.is_mapp_tertiary) {
              innerLevel = 'T';
            } else if (masterInfo.is_mapp_secondary) {
              innerLevel = 'S';
            } else if (masterInfo.is_mapp_primary) {
              innerLevel = 'P';
            }
          }

          if (innerLevel) {
            let ChildModel, GeneralChildModel;
            ChildModel = await getDynamicModel(innerLevel, codeFound.product.u_id);

            if (!isGeneral) {
              console.log("--------------------General Product Found----------------");
            }
            else {   // General code
              GeneralChildModel = await getDynamicModel(innerLevel, codeFound.assigned_product.u_id);
              // ChildModel = await getDynamicModel(innerLevel, codeFound.assigned_product?.u_id);   // UID of asssigned product
            }
            if (!ChildModel) {
              return res.status(200).send({ success: 0, message: `Child Model (${!ChildModel ? 'Specific' : 'General'}) Not Found` })
            }

            // Updating parents of specific children
            let childCodes = await ChildModel.findAll({
              where: {
                is_replaced: false,
                mapped_to_parent: codeFound.id    // Previous Parent 
              },
              raw: true
            })
            let generalChildCodes = [];
            // Updating parents of general children
            if (isGeneral) {
              generalChildCodes = await GeneralChildModel.findAll({
                where: {
                  is_replaced: false,
                  mapped_to_parent: codeFound.id    // Previous Parent 
                },
                raw: true
              })
            }

            // generalChildCodes.forEach else.isGeneral=true

            let allChilds = [...childCodes, ...generalChildCodes];

            // innerLevel, masterInfo.batch_no, masterInfo.mfg_date, masterInfo.exp_date, codeFound.sku

            let pLevel = innerLevel;
            let pBatch = masterInfo.batch_no;
            let pMfgDate = masterInfo.mfg_date;
            pMfgDate = moment(new Date(pMfgDate)).format('YYMMDD');
            let pExpDate = masterInfo.exp_date;
            pExpDate = moment(new Date(pExpDate)).format('YYMMDD');


            console.log("pMfgDate>>>>>>>>>>>>>>", pMfgDate);
            console.log("pExpDate>>>>>>>>>>>>>>>", pExpDate);
            let pSku = codeFound.product.sku;
            let pIsGeneral;
            allChilds.forEach(async element => {
              pIsGeneral = element.is_general;
              element.qr_code = await generateQrCodeString(element.unique_code, pLevel, pBatch, pMfgDate, pExpDate, pSku, pIsGeneral);
              childs.push({ unique_code: element.unique_code, qr_code: element.qr_code })
            });
          }
          else {
            console.log("----------Inner Level Not Found------------");
          }
        }
      }


      let storageBinId = codeDetail.storage_bin_id;
      let storageBinData = await models.storageBinsModel.findOne({
        where: {
          id: storageBinId
        },
        attributes: ["location_id"],
        raw: true
      });

      let locId = storageBinData.location_id;

      let zrtInfo = await models.locationModel.findOne({
        where: {
          id: locId
        },
        attributes: ["zone_id", "region_id", "territory_id"],
        raw: true
      });

      console.log("zrt info>>>>>>", zrtInfo);

      console.log("loc>>>>>", storageBinData)
      let isRewardsApplicable = false;

      let isRegisterApplicable = false;
      if (key != null) {
        if (req.roleId == 0 && key == 'P') {
          // for customer  
          isRegisterApplicable = true;
        }
        else if (req.roleId == 1 && key == 'O') {
          // for dealer
          isRegisterApplicable = true;
        }
        else if (req.roleId == 3 && (key == 'P' || key == 'O')) {
          // for retailer
          isRegisterApplicable = true;
        }
      }

      let batchInfo = codeDetail.product_batch;

      let mrpData = await commonController.calculateMRP(codeDetail.product_batch, codeDetail.product_batch.mrp);
      console.log("---Mrp Calculated", mrpData);

      console.log("level>>>>>", level);
      codeDetail.product.mrp = codeDetail.product_batch.mrp;
      if (level == 'P') {
        codeDetail.product.mrp = mrpData.pMRP;
      } else if (level == 'S') {
        codeDetail.product.mrp = mrpData.sMRP;
      } else if (level == 'T') {
        codeDetail.product.mrp = mrpData.tMRP;
      } else if (level == 'O') {
        codeDetail.product.mrp = mrpData.oMRP;
      }

      if (batchInfo.mfgDate) {
        mfgDate = moment(new Date(batchInfo.mfgDate)).format('DD/MMM/YYYY').toUpperCase();
      }

      if (batchInfo.expDate) {
        expDate = moment(new Date(batchInfo.expDate)).format('DD/MMM/YYYY').toUpperCase();
      }

      let isAlreadyPurchased = false;
      let purchasedByOther = false;
      let isRewardsClaimed = false;
      let isClaimedByOther = false;
      let isOutSideScanning = false;
      let locationId = locId;

      if ((codeDetail.customer_id && req.roleId == 0) || (codeDetail.dealer_id && req.roleId == 1) || codeDetail.retailer_id && req.roleId == 3) {
        console.log(">>>>>>>>>>>Already Purchased");
        isAlreadyPurchased = true;
        if ((codeDetail.customer_id != req.consumerId && req.roleId == 0) || (codeDetail.dealer_id != req.consumerId && req.roleId == 1) || (codeDetail.retailer_id != req.consumerId && req.roleId == 3)) {
          console.log(">>>>>>>>>>>Purchased By Other");
          purchasedByOther = true
        }
        else {
          // Users All Details Will Be saved in tables according to their date of registration
          let tableUID = moment(req.createdAt).format('MM_YY')
          console.log(">>>>>tableUID", tableUID);
          let CustomerProductModel = await DynamicModels.getCustomerProductsModel(tableUID);
          console.log("customModel >>>>>>>>", CustomerProductModel);

          let registeredInfo = await CustomerProductModel.findOne({
            where: {
              unique_code: req.query.unique_code,
              customer_id: req.consumerId
            }
          })
          if (registeredInfo) {
            if (registeredInfo.customer_id != req.consumerId) {
              purchasedByOther = true
            }
            else {
              if (registeredInfo.is_reward_claimed) {
                isRewardsClaimed = true;
              }
            }
          } else {
            console.log(">>>>>>>>>>>>>Product Not Registered!");
            // return res.status(200).send({ success: 0, message: "Product Not Registered!" })
          }
        }
      }

      console.log("pid>>>>>>>", codeDetail.product.id)

      if (req.consumerId) {
        let rewardInfo = await rewardExist(req.roleId, req.consumerId, batchInfo.id, codeDetail.product.id, key, zrtInfo);
        // auto product register if reward not available for user

        // isOutSideScan
        isRewardsApplicable = rewardInfo.schemeExists;
        isOutSideScanning = rewardInfo.isOutSideScan;

        console.log("rewardInfo>>>>>>>", rewardInfo);
        console.log("isRewardsApplicable>>>>>>>>", isRewardsApplicable);
        console.log("?>>>>>>>>>>>>isOutSideScanning>>>>>", isOutSideScanning)
        // isOutSideScanning = await antiCounterfit(req.roleId, req.consumerId,zrtInfo);
        if (!isRewardsApplicable) {
          // AUTO register product so that scaning history.  
        }
      }
      else {
        rewardInfo = await rewardExistOnBatch(batchInfo.id, codeDetail.product.id, key);
        isRewardsApplicable = rewardInfo.schemeExists;
      }

      codeDetail.isAlreadyPurchased = isAlreadyPurchased
      codeDetail.purchasedByOther = purchasedByOther
      codeDetail.isRewardsClaimed = isRewardsClaimed;
      codeDetail.isRewardsApplicable = isRewardsApplicable;
      codeDetail.batchId = batchInfo.id;
      codeDetail.registerProductInfo = isRegisterApplicable
      codeDetail.isOutSideScanning = isOutSideScanning;
      codeDetail.scanningLocationId = locationId;
      codeDetail.parent = parent;
      codeDetail.child = childs;
      console.log(">>>>>>>>>>>>>Object", codeDetail);


      if (codeDetail?.product?.marketed_by) {
        let cCareDetails = await models.customerCareModel.findOne({
          where: {
            id: codeDetail?.product?.marketed_by,
            is_3p_logo: true
          },
          attributes: ['id'],
          raw: true
        })
        if (cCareDetails) {
          codeDetail.thirdParty = true;
        }
      }

      return res.status(200).send({ success: 1, data: codeDetail, })

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: error.message });
    }

  },
  counterfitRegister: async (req, res) => {
    try {
      let validator = new v(req.body, {
        uniqueCode: "required",
        productId: "required",
        batchId: "required",
        categoryId: "required",
        // latitude: "required",
        // longitude: "required",
        type: "required",
        locationId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: "0", message: validatorError });
      }

      let uidAndLevel = await getUIDAndLevel(req.body.uniqueCode);
      let CustomModel = await getDynamicModel(uidAndLevel.level, uidAndLevel.UID);
      let codeDetail = await CustomModel.findOne({
        where: {
          unique_code: req.body.uniqueCode,
          // is_active: true
        },
        raw: true,
        nest: true
      });
      if (!codeDetail) {
        return res.status(200).send({ success: 0, message: "Code id Not found" })
      }

      if ((codeDetail.customer_id && req.roleId == 0) || (codeDetail.dealer_id && req.roleId == 1) || (codeDetail.retailer_id && req.roleId == 3)) {
        // return res.status(200).send({ success: 0, message: "Already Registered" })
        // cunterfeit register here

        // let tableUID = moment(req.createdAt).format('MM_YY');
        // console.log(">>>>>tableUID", tableUID);
        // let CustomerCunterfeitModel = await DynamicModels.getcunterfeitModel(tableUID);
        // console.log("customModel >>>>>>>>", CustomerCunterfeitModel);

        let registeredInfo = await models.CounterfitModel.findOne({
          where: {
            unique_code: req.body.uniqueCode,
            role_id: req.roleId,
            customer_id: req.consumerId
          },
          raw: true
        });

        if (registeredInfo) {
          console.log(">>>>>>>>>>>>>Same user again scan code!");
          return res.status(200).send({ success: 1, message: "" });
          // return res.status(200).send({ success: 0, message: "Product Already Registered!" })
        } else {

          let consumerDetails = await ConsumerModel.findOne({
            where: {
              id: req.consumerId
            },
            raw: true,
            attributes: ["id", "city_id"]
          })
          // if (!consumerDetails) {
          //   return res.status(200).send({ success: 0, message: "User Not found" })
          // }

          if (req.roleId == 1 || req.roleId == 2 || req.roleId == 3) {
            consumerDetails = await ChannelPartners.findOne({
              where: {
                id: req.consumerId
              },
              raw: true,
              attributes: ["id", "city_id"]
            });
          }

          if (!consumerDetails) {
            return res.status(200).send({ success: 0, message: "User Not found" })
          }

          let data = {
            id: uuid(),
            customer_id: req.consumerId,
            role_id: req.roleId,
            category_id: req.body.categoryId,
            product_id: req.body.productId,
            batch_id: req.body.batchId, // null 
            unique_code: req.body.uniqueCode,
            code_id: codeDetail.id,
            level: uidAndLevel.level,
            city_id: consumerDetails.city_id,
            latitude: req.body.latitude ?? null,
            longitude: req.body.longitude ?? null,
            type: req.body.type,
            location_id: req.body.locationId

          };

          console.log("data>>>>>>>>>>>>", data);

          await models.CounterfitModel.create(data);
          // return res.status(200).send({ success: 1, message: "cunterfeit register success" });
          console.log("cunterfeit register success");
          return res.status(200).send({ success: 1, message: "success" });
        }
      }
      else {
        if (req.consumerId) {
          let registeredInfo = await models.CounterfitModel.findOne({
            where: {
              unique_code: req.body.uniqueCode,
              role_id: req.roleId,
              customer_id: req.consumerId
            },
            raw: true
          });

          if (registeredInfo) {
            console.log(">>>>>>>>>>>>>Same user again scan code!");
            return res.status(200).send({ success: 1, message: "" });
            // return res.status(200).send({ success: 0, message: "Product Already Registered!" })
          } else {

            let consumerDetails = await ConsumerModel.findOne({
              where: {
                id: req.consumerId
              },
              raw: true,
              attributes: ["id", "city_id"]
            })
            // if (!consumerDetails) {
            //   return res.status(200).send({ success: 0, message: "User Not found" })
            // }

            if (req.roleId == 1 || req.roleId == 2 || req.roleId == 3) {
              consumerDetails = await ChannelPartners.findOne({
                where: {
                  id: req.consumerId
                },
                raw: true,
                attributes: ["id", "city_id"]
              });
            }

            if (!consumerDetails) {
              return res.status(200).send({ success: 0, message: "User Not found" })
            }

            let data = {
              id: uuid(),
              customer_id: req.consumerId,
              role_id: req.roleId,
              category_id: req.body.categoryId,
              product_id: req.body.productId,
              batch_id: req.body.batchId, // null 
              unique_code: req.body.uniqueCode,
              code_id: codeDetail.id,
              level: uidAndLevel.level,
              city_id: consumerDetails.city_id,
              latitude: req.body.latitude ?? null,
              longitude: req.body.longitude ?? null,
              type: req.body.type,
              location_id: req.body.locationId
            };

            console.log("data>>>>>>>>>>>>", data);

            await models.CounterfitModel.create(data);
            // return res.status(200).send({ success: 1, message: "cunterfeit register success" });
            console.log("cunterfeit register success");
            return res.status(200).send({ success: 1, message: "success" });
          }
        }
        return res.status(200).send({ success: 1, message: "cunterfeit register failed" });
      }
    } catch (ex) {
      console.log("error in cunterfeit register", ex);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
  registerProduct: async (req, res) => {
    try {
      let validator = new v(req.body, {
        // latitude: "required",
        // longitude: "required",
        uniqueCode: "required",
        productId: "required",
        batchId: "required",
        categoryId: "required",
        latitude: "required",
        longitude: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: "0", message: validatorError });
      }

      let uidAndLevel = await getUIDAndLevel(req.body.uniqueCode);
      let CustomModel = await getDynamicModel(uidAndLevel.level, uidAndLevel.UID);
      let codeDetail = await CustomModel.findOne({
        where: {
          unique_code: req.body.uniqueCode,
          // is_active: true
        },
        raw: true,
        nest: true
      });
      if (!codeDetail) {
        return res.status(200).send({ success: 0, message: "Code id Not found" })
      }

      if ((codeDetail.customer_id && req.roleId == 0) || (codeDetail.dealer_id && req.roleId == 1) || (codeDetail.retailer_id && req.roleId == 3)) {
        return res.status(200).send({ success: 0, message: "Already Registered" })
      }

      let isExpired = false;
      let now = new Date();
      let batchDetails = await models.ProductBatchModel.findOne({ where: { id: codeDetail.batch_id }, raw: true });
      if (batchDetails) {
        if (new Date(batchDetails.exp_date).getTime() - now.getTime() > 0) {
          isExpired = true;
        }
      }

      let tableUID = moment(req.createdAt).format('MM_YY')
      console.log(">>>>>tableUID", tableUID);
      let CustomerProductModel = await DynamicModels.getCustomerProductsModel(tableUID);
      console.log("customModel >>>>>>>>", CustomerProductModel);

      let registeredInfo = await CustomerProductModel.findOne({
        where: {
          unique_code: req.body.uniqueCode,
          role_id: req.roleId,
          customer_id: req.consumerId
        },
        raw: true
      })
      if (registeredInfo) {
        console.log(">>>>>>>>>>>>>Product Already Registered!");
        return res.status(200).send({ success: 0, message: "Product Already Registered!" })
      } else {

        let locationDetails = await LocationTracker.trackLocation(req.body.latitude, req.body.longitude);

        let consumerDetails = await ConsumerModel.findOne({
          where: {
            id: req.consumerId
          },
          raw: true,
          attributes: ["id", "city_id"]
        })
        // if (!consumerDetails) {
        //   return res.status(200).send({ success: 0, message: "User Not found" })
        // }

        if (req.roleId == 1 || req.roleId == 2 || req.roleId == 3) {
          consumerDetails = await ChannelPartners.findOne({
            where: {
              id: req.consumerId
            },
            raw: true,
            attributes: ["id", "city_id"]
          });
        }

        if (!consumerDetails) {
          return res.status(200).send({ success: 0, message: "User Not found" })
        }

        let data = {
          id: uuid(),
          customer_id: req.consumerId,
          role_id: req.roleId,
          category_id: req.body.categoryId,
          product_id: req.body.productId,
          batch_id: req.body.batchId, // null 
          unique_code: req.body.uniqueCode,
          code_id: codeDetail.id,
          level: uidAndLevel.level,
          city_id: consumerDetails.city_id,
          latitude: req.body.latitude,
          longitude: req.body.longitude,
          is_expired: isExpired,
          // consumer_type: roleId,
        };

        if (locationDetails.status) {
          data.latitude = locationDetails.data.storeLat;
          data.longitude = locationDetails.data.storeLng;
        }

        console.log(">>>>>>>>>>>>data", data);

        await CustomerProductModel.create(data);

        if (req.roleId == 0) {
          await CustomModel.update({
            customer_id: req.consumerId

          }, {
            where: {
              id: codeDetail.id
            }
          })
        }
        else if (req.roleId == 1) {
          await CustomModel.update({
            dealer_id: req.consumerId

          }, {
            where: {
              id: codeDetail.id
            }
          })
        }
        else if (req.roleId == 3) {
          await CustomModel.update({
            retailer_id: req.consumerId

          }, {
            where: {
              id: codeDetail.id
            }
          })
        }

        return res.status(200).send({ success: 1, message: "Product registered successfully" });
      }

    } catch (ex) {
      console.log("error in register product", ex);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
  claimRewards: async (req, res) => {
    try {
      let validator = new v(req.body, {
        // latitude: "required",
        // longitude: "required",
        uniqueCode: "required",
        codeId: "required",
        productId: "required",
        batchId: "required",
        categoryId: "required"
      });
      console.log("req body", req.body);

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: "0", message: validatorError });
      }

      let tableUID = moment(req.createdAt).format('MM_YY')
      let isLuckyDrawCardReceive = false;
      console.log(">>>>>tableUID", tableUID);
      let CustomerProductModel = await DynamicModels.getCustomerProductsModel(tableUID);
      console.log("customModel >>>>>>>>", CustomerProductModel);

      let registeredInfo = await CustomerProductModel.findOne({
        where: {
          unique_code: req.body.uniqueCode,
          role_id: req.roleId,
          customer_id: req.consumerId
        },
        raw: true
      })
      if (!registeredInfo) {
        console.log(">>>>>>>>>>>>>Product Not Registered!");
        return res.status(200).send({ success: 0, message: "Product Not Registered!" })
      }

      if (registeredInfo.is_reward_claimed) {
        console.log(">>>>>>>>>>>>>Rewards Already Claimed!");
        return res.status(200).send({ success: 0, message: "Reward Already Claimed!" })
      }

      // let uidAndLevel = await getUIDAndLevel(req.body.uniqueCode);

      // let CustomModel = await getDynamicModel(uidAndLevel.level, uidAndLevel.UID)

      // let city = await City.findOne({
      //   where: {
      //     id: registeredInfo.city_id
      //   },
      //   raw: true,
      //   attributes: ['id', 'state_id']
      // });
      // if (!city) {
      //   return res.status(200).send({ success: 0, message: "Please Update Your City To Get Rewards!" })
      // }
      let cityDetail = await models.cityModel.findOne({ where: { id: registeredInfo.city_id }, raw: true });

      // let pincodes = await models.pincodeModel.findAll({where: {city_id: cityDetail.id},raw: true});

      // let PincodeList = await models.pincodeModel.findAll({where: {pincode:pincodes.pincode},attributes:['pincode','city_id'],raw: true})
      // let codes = PincodeList.map(x => x.city_id);
      // let zoneChildHistoryDetails = await models.territoryHistoryMasterModel.findOne({
      //   where: {
      //     villages: { [Op.contains]: [registeredInfo.city_id] },
      //   },
      //   order: [["createdAt", "DESC"]],
      //   raw: true
      // })

      // if (!zoneChildHistoryDetails) {
      //   return res.status(200).send({ success: 0, message: "Please Update Your City To Get Rewards!" })
      // }

      //get region Details history id
      let regionIds = [];
      let zoneChildHistoryDetails = await models.zoneChildMasterModel.findAll({
        where: {
          cities: { [Op.contains]: [cityDetail.district_id] },
        },
        attributes: ['zone_history_id'],
        order: [["createdAt", "DESC"]],
        raw: true
      })

      if (zoneChildHistoryDetails.length > 0) {
        regionIds = zoneChildHistoryDetails.map(x => x.zone_history_id);
        // return res.status(200).send({ success: 0, message: "Better Luck Next Time!" })
      }

      //get territory Details history idcmd
      let territoryIds = [];
      let territoryHistoryDetails = await models.territoryHistoryMasterModel.findAll({
        where: {
          villages: { [Op.contains]: [cityDetail.id] },
        },
        attributes: ['id'],
        order: [["createdAt", "DESC"]],
        limit: 1,
        raw: true
      })

      if (territoryHistoryDetails.length > 0) {
        territoryIds = territoryHistoryDetails.map(x => x.id);
        // return res.status(200).send({ success: 0, message: "Please Update Your City To Get Rewards!" })
      }

      //get zone Details history id
      let zoneIds = [];
      let zoneHistoryDetails = await models.parentZoneHistoryMasterModels.findAll({
        where: {
          states: { [Op.contains]: [cityDetail.state_id] },
        },
        attributes: ['id'],
        order: [["createdAt", "DESC"]],
        raw: true
      })

      if (zoneHistoryDetails.length > 0) {
        zoneIds = zoneHistoryDetails.map(x => x.id);
        // return res.status(200).send({ success: 0, message: "Please Update Your City To Get Rewards!" })
      }

      let batchDetails = await models.ProductBatchModel.findOne({ where: { id: registeredInfo.batch_id }, raw: true });
      if (!batchDetails) {
        return res.status(200).send({ success: 0, message: "Product Batch Not Found" })
      }

      let stateId = [];
      // stateId.push(zoneChildHistoryDetails.state_id);

      let level = registeredInfo.level;
      level = level == 'P' ? 1 : level == 'S' ? 2 : level == 3 ? 'T' : 4

      let whereClause = {
        [Op.and]: [
          { consumer_type: req.roleId },
          { esign_status: 2 },
          { lvl_type: { [Op.contains]: [level] } },
          {
            [Op.or]: [
              { regions: { [Op.overlap]: regionIds } },
              { territories: { [Op.overlap]: territoryIds } },
              { zones: { [Op.overlap]: zoneIds } },
            ]
          },
          {
            [Op.or]: [
              {
                type: 2  /// infinite
              },
              {
                type: 1,
                start_date: {
                  [Op.lte]: registeredInfo.createdAt  // Eligible For Reward On The Basis Product Registration
                },
                end_date: {
                  [Op.gte]: new Date()
                }
              }
            ]
          },
          { sku_id: { [Op.contains]: [req.body.productId] } },
          { product_batch: { [Op.contains]: [req.body.batchId] } },
          { is_deleted: false }
        ]
        // states: { [Op.contains]: stateId },
      }
      let ScratchCardModel = await DynamicModels.scratchCardsModel(tableUID);

      let pointAllocateList = await PointAllocation.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: req.roleId == 0 ? 1 : 5,
        raw: true
      });

      let scratchCardIds = null;
      let scratchPoint = 0;
      let PointallocationIds = [];
      let totalPoints = 0;
      for (let index = 0; index < pointAllocateList.length; index++) {
        let extraPoints = 0;
        let milestone = null;
        const pointAllocate = pointAllocateList[index];
        PointallocationIds.push(pointAllocate.id);
        let points = 0;
        if (pointAllocate) {
          // if(!pointAllocate.lvl_type.include(level)){
          //   return res.status(200).send({ success: 0, message: "Invalid" })
          // }
          if (pointAllocate.mode == 1) {
            if (pointAllocate.mode_points[0].percentage) {

              let batchInfo = await models.ProductBatchModel.findOne({
                where: {
                  id: req.body.batchId
                },
                raw: true,
              });

              console.log(">>>>>>>>>>>batchInfo", batchInfo);

              if (pointAllocate.lvl_type == 1) {   //
                points = ((batchInfo.mrp * pointAllocate.mode_points[0].percentage) / 100).toFixed(0);
              }
              else if (pointAllocate.lvl_type == 2) {
                let sSize = 1;
                if (batchInfo.secondary_size) {
                  sSize = batchInfo.secondary_size
                }
                points = ((batchInfo.mrp * sSize * pointAllocate.mode_points[0].percentage) / 100).toFixed(0);
              }
              else if (pointAllocate.lvl_type == 3) {
                let tSize = 1;
                let sSize = 1;

                if (batchInfo.tertiary_size) {
                  tSize = batchInfo.tertiary_size
                }
                if (batchInfo.secondary_size) {
                  sSize = batchInfo.secondary_size
                }
                points = ((batchInfo.mrp * tSize * sSize * pointAllocate.mode_points[0].percentage) / 100).toFixed(0);
              }

              else if (pointAllocate.lvl_type == 4) {
                let oSize = 1;
                let tSize = 1;
                let sSize = 1;

                if (batchInfo.outer_size) {
                  oSize = batchInfo.outer_size
                }

                if (batchInfo.tertiary_size) {
                  tSize = batchInfo.tertiary_size
                }

                if (batchInfo.secondary_size) {
                  sSize = batchInfo.secondary_size
                }
                points = ((batchInfo.mrp * oSize * tSize * sSize * pointAllocate.mode_points[0].percentage) / 100).toFixed(0);
              }
            }
          }
          else if (pointAllocate.mode == 2) {
            points = getRandomIntInclusive(pointAllocate.mode_points[0].min, pointAllocate.mode_points[0].max); // need to implement
          }
          else if (pointAllocate.mode == 3) {
            let PrimaryCodes = codePrimarySize(batchDetails, 1, level);
            let factor = uniteCalulation(batchDetails.standard_unit, batchDetails.size);
            let totalVolume = factor * PrimaryCodes;
            points = (totalVolume * pointAllocate.mode_points[0].volumePoints) / pointAllocate.mode_points[0].volumes;
          }
          else if (pointAllocate.mode == 4) {
            points = pointAllocate.mode_points[0].staticPoints;
          }

          if (pointAllocate.scheme_type > 0) {
            if (pointAllocate.scheme_type == 1) { //slab base
              let schemeResult = await schemeWisePointAllocation(1, level, batchDetails, pointAllocate, CustomerProductModel, ScratchCardModel, req);
              extraPoints = schemeResult.extraPoints;
              milestone = schemeResult.milestone;
            }
            else if (pointAllocate.scheme_type == 2) {// Buy More And Get More
              let schemeResult = await schemeWisePointAllocation(2, level, batchDetails, pointAllocate, CustomerProductModel, ScratchCardModel, req);
              extraPoints = schemeResult.extraPoints;
              milestone = schemeResult.milestone;
            }
            else if (pointAllocate.scheme_type == 3) {
              //wallet base if required 
            }
            else if (pointAllocate.scheme_type == 4) {
              let schemeResult = await schemeWisePointAllocation(4, level, batchDetails, pointAllocate, CustomerProductModel, ScratchCardModel, req);
              extraPoints = schemeResult.extraPoints;
              milestone = schemeResult.milestone;
            }
            else if (pointAllocate.scheme_type == 5) { // Volume Based
              let SkuTypeIdList = pointAllocate.scheme_points.map(x => x.SkuTypeId);
              let pointScheme = [];
              if (pointAllocate.sku_type == 1) { // Product range
                let findProduct = await models.productsModel.findOne({ where: { product_range: { [Op.in]: SkuTypeIdList }, id: req.body.productId }, raw: true });
                if (findProduct) {
                  pointScheme = pointAllocate.scheme_points.filter(x => x.SkuTypeId == findProduct.product_range);
                }
              }
              else if (pointAllocate.sku_type == 2) { //Product Group 
                let findProduct = await models.productsModel.findOne({ where: { product_group: { [Op.in]: SkuTypeIdList }, id: req.body.productId }, raw: true });
                if (findProduct) {
                  pointScheme = pointAllocate.scheme_points.filter(x => x.SkuTypeId == findProduct.product_group);
                }
              }
              else if (pointAllocate.sku_type == 3) { //skus
                let findProduct = await models.productsModel.findOne({ where: { id: { [Op.in]: SkuTypeIdList }, id: req.body.productId }, raw: true });
                if (findProduct) {
                  pointScheme = pointAllocate.scheme_points.filter(x => x.SkuTypeId == findProduct.id);
                }
              }
              else if (pointAllocate.sku_type == 4) { //Product category
                let findProduct = await models.productsModel.findOne({ where: { category: { [Op.in]: SkuTypeIdList }, id: req.body.productId }, raw: true });
                if (findProduct) {
                  pointScheme = pointAllocate.scheme_points.filter(x => x.SkuTypeId == findProduct.category);
                }
              }
              let PrimaryCodes = codePrimarySize(batchDetails, 1, level);
              let factor = uniteCalulation(batchDetails.standard_unit, batchDetails.size);
              let totalVolume = factor * PrimaryCodes;
              points = (totalVolume * pointScheme[0].volumePoints) / pointScheme[0].volumes;
            }
            else if (pointAllocate.scheme_type == 6) { // Bundle scheme
              let countWhereClause = {
                // scheme_id: pointAllocate.id,
                [Op.and]: [
                  {
                    [Op.or]: [
                      { scheme_id: { [Op.contains]: [pointAllocate.id] } },
                      // { product_id: { [Op.in]: pointAllocate.sku_id } }
                    ]
                  },
                  { level: registeredInfo.level },
                  { city_id: cityDetail.id },
                  { customer_id: req.consumerId }
                ],
              };

              let scannedCount = await CustomerProductModel.findAll({
                where: countWhereClause,
                attributes: ["id", "product_id"],
                order: [['createdAt', 'DESC']],
                raw: true
              });

              // Create an idCounts object with initial counts set to 0 for all values in array y
              let idCounts = pointAllocate.sku_id.map(x => { return { id: x, count: 0 } });

              // Count occurrences of each product_id in array x and update the idCounts object
              scannedCount.forEach(item => {
                const productId = item.product_id;
                let index = idCounts.findIndex(x => x.id == productId);
                idCounts[index].count++;
              });
              let index = idCounts.findIndex(x => x.id == req.body.productId);
              idCounts[index].count++;

              let cardPoint = await ScratchCardModel.count({ where: { scheme_id: pointAllocate.id, customer_id: req.consumerId, points: { [Op.gt]: 0 } } });

              if (idCounts.every(x => x.count > cardPoint)) {
                extraPoints = pointAllocate.scheme_points[0].extra_points;
              }
            }
            else if (pointAllocate.scheme_type == 7) {
              let countWhereClause = {
                // scheme_id: pointAllocate.id,
                [Op.and]: [
                  {
                    [Op.or]: [
                      { scheme_id: { [Op.contains]: [pointAllocate.id] } },
                      // { product_id: { [Op.in]: pointAllocate.sku_id } }
                    ]
                  },
                  { level: registeredInfo.level },
                  { city_id: cityDetail.id },
                  { customer_id: req.consumerId }
                ],
              };

              let scannedCount = await CustomerProductModel.findAll({
                where: countWhereClause,
                attributes: ["id", "product_id"],
                order: [['createdAt', 'DESC']],
                raw: true
              });
              let count = scannedCount.length + 1;
              let minScanned = pointAllocate.scheme_points[0].min_scanned;
              if (count % minScanned == 0) {
                extraPoints = pointAllocate.scheme_points[0].extra_points;
              }
            }
          }

          points = Number(points) + Number(extraPoints);
          points = Math.ceil(points);
          if (points > 0) {
            await commonController.addorUpdateSchemePoints(pointAllocate.id, 1, points, pointAllocate.point_valuation_id, pointAllocate.current_valuation);
            // notificationController.AddNotification(req.consumerId, points + ' Points', "You've won " + points + " points", 0);
          }
          totalPoints = totalPoints + points;
        }
        let scratchCardId = uuid();
        if (index == 0) {
          scratchPoint = points;
          scratchCardIds = scratchCardId;
        }
        await ScratchCardModel.create({
          id: scratchCardId,
          card_type: 1,  // 1 Loyalty Points 2 Lucky Draw
          unique_code: req.body.uniqueCode,
          points: points,
          customer_id: req.consumerId,
          scheme_id_milestone: milestone,
          scheme_id: pointAllocate ? pointAllocate.id : null,
        })
      }




      let luckyDrawDetail = await LuckyDraws.findOne({
        where: {
          [Op.and]: [
            { consumer_type: req.roleId },
            { status: 1 },
            { esign_status: 2 },
            { lvl_type: { [Op.contains]: [level] } },
            { skus: { [Op.contains]: [req.body.productId] } },
            { product_batch: { [Op.contains]: [req.body.batchId] } },
            {
              [Op.or]: [
                { regions: { [Op.overlap]: regionIds } },
                { territories: { [Op.overlap]: territoryIds } },
                { zones: { [Op.overlap]: zoneIds } },
              ]
            },
            {
              start_date: { [Op.lte]: registeredInfo.createdAt }
            },
            {
              end_date: {
                [Op.gte]: new Date()
              }
            }
          ],
        },
        order: [['createdAt', 'DESC']],
        raw: true
      });
      if (luckyDrawDetail) {
        let drawUID = moment(luckyDrawDetail.createdAt).format('MM_YY');
        let luckyDrawUsersModel = await DynamicModels.luckyDrawUsersModel(drawUID);
        let scannedCount = await CustomerProductModel.count({
          where: {
            // scheme_id: pointAllocate.id,
            [Op.and]: [
              { createdAt: { [Op.gte]: luckyDrawDetail.start_date } },
              { createdAt: { [Op.lte]: luckyDrawDetail.end_date } },
              { product_id: { [Op.in]: luckyDrawDetail.skus } },
              { batch_id: { [Op.in]: luckyDrawDetail.product_batch } },
              { level: registeredInfo.level },
              { city_id: cityDetail.id },
              { customer_id: req.consumerId }
            ],
          },
          order: [['createdAt', 'DESC']],
          raw: true
        })
        if (((scannedCount) % luckyDrawDetail.min_scanned_prod) == 0 || scannedCount + 1 > luckyDrawDetail.min_scanned_prod) {
          let luckyCount = await ScratchCardModel.count({
            where: {
              card_type: 2,
              scheme_id: luckyDrawDetail.id,
              customer_id: req.consumerId
            }
          })
          if (luckyCount == 0) {
            let luckyCartId = uuid();
            isLuckyDrawCardReceive = true;
            await ScratchCardModel.create({
              id: luckyCartId,
              card_type: 2,  // 1 Loyalty Points 2 Lucky Draw
              customer_id: req.consumerId,
              scheme_id: luckyDrawDetail ? luckyDrawDetail.id : null,
              is_locked: true
            });

            await luckyDrawUsersModel.create({
              id: luckyCartId,
              customer_id: req.consumerId,
              scheme_id: luckyDrawDetail ? luckyDrawDetail.id : null,
              uid: tableUID,
              is_discarded: false
            })

            notificationController.AddNotification(req.consumerId, 'Gift Card', "You've won " + ' gift card', 1)
          }
        }
      }

      if (pointAllocateList.length == 0) {
        let scratchCardId1 = uuid();
        await ScratchCardModel.create({
          id: scratchCardId1,
          card_type: 1,  // 1 Loyalty Points 2 Lucky Draw
          unique_code: req.body.uniqueCode,
          points: 0,
          customer_id: req.consumerId,
          scheme_id_milestone: null,
          scheme_id: null,
        })
        scratchCardIds = scratchCardId1;
      }


      await CustomerProductModel.update({
        points: totalPoints,
        is_reward_claimed: true,
        scheme_id: PointallocationIds.length > 0 ? PointallocationIds : null,
      }, {
        where: {
          id: registeredInfo.id
        },
        raw: true
      })

      let resObj = {
        points: scratchPoint,
        cardId: scratchCardIds,
        isLuckyDrawCardReceive: isLuckyDrawCardReceive
      }
      return res.status(200).send({ success: 1, message: "Rewards Collected!", data: resObj })

    } catch (ex) {
      console.log("error bcknd", ex);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },

  addScratchCards: async (req, res) => {
    try {
      let validator = new v(req.body, {
        consumer_id: 'required',
        qr_code: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: '0', message: validatorError })
      }
      let consumerId = req.consumerId;

      let product_unique_id = req.body.qr_code.substring(2, 5);
      let level = req.body.qr_code.substring(5, 6);
      let type = 1;
      console.log("type", type);
      if (type != 1 && type != 4) {
        return res.status(200).send({ success: '0', message: 'no scratch card' })
      }

      //Find Consumer Type

      let consumer_detail = await consumers.findOne({
        where: { id: consumerId },
        raw: true,
        attributes: ['id', 'type']
      });
      let sec_consumers_arr = []
      if (consumer_detail) {
        sec_consumers_arr.push(consumer_detail.id);
      }
      if (!consumer_detail) {
        let sec_consumers = await secondaryConsumers.findOne({
          where: {
            id: consumerId
          },
          raw: true,
          attributes: ['id', 'dealer_id']
        })
        if (!sec_consumers) {
          return res.status(200).send({ success: '0', message: 'Consumer not found' })
        } else {
          consumer_detail = await consumers.findOne({
            where: {
              id: sec_consumers.dealer_id
            },
            raw: true,
            attributes: ['id', 'type']
          });
          sec_consumers_arr = await secondaryConsumers.findAll({
            where: {
              dealer_id: consumer_detail.id
            },
            raw: true
          });
          sec_consumers_arr = sec_consumers_arr.map(x => x.id);
          sec_consumers_arr.push(consumer_detail.id);
        }
      }

      // let table_id = "trusted_qrcodes_" + product_unique_id.toLowerCase();
      // let trusted_qrcodes = require("../../models/")[table_id];
      let trusted_qrcodes = '';
      if (level == P) {
        trusted_qrcodes = await DynamicModels.getPrimaryQRCodesModel(product_uid);
      } else if (level == S) {
        trusted_qrcodes = await DynamicModels.getSecondaryQRCodesModel(product_uid);
      } else if (level == T) {
        trusted_qrcodes = await DynamicModels.getTertiaryQRCodesModel(product_uid);
      } else if (level == O) {
        trusted_qrcodes = await DynamicModels.getOuterQRCodesModel(product_uid);
      }
      //Find QR Code
      let code_details;
      if (type == 1) {
        code_details = await trusted_qrcodes.findOne({
          where: {
            [Op.or]: [
              {
                unique_code: req.body.qr_code
              },
              // {
              //   tft_trusted_qrcode: req.body.qr_code
              // }
            ]
            // is_scan_on_production_line: true
          },
          raw: true,
          attributes: ['id']
        });
      }
      if (type == 4) {
        code_details = await shipperCodes.findOne({
          where: {
            unique_code: req.body.qr_code,
            is_scaned: true
          },
          attributes: ['unique_code', 'id']
        })
      }

      if (!code_details) {
        return res.status(200).send({ success: '0', message: 'QR Code Not Found!' })
      }

      product_unique_id = product_unique_id.toUpperCase();


      let registered = await ScratchCardModel.findOne({
        where: {
          qr_code: req.body.qr_code,
          consumer_id: {
            [Op.in]: sec_consumers_arr
          }
        }
      })
      if (registered) {
        return res.status(200).send({ success: '0', message: 'already registered' })
      }

      //Find existing lucky draws
      // let luckyDraws = await LuckyDraws.findAll({
      //   where: {
      //     consumer_type: consumer_detail.type,
      //     lvl_type: type,
      //     status: 1
      //   },
      //   raw: true
      // });
      // let count = 0
      // if (luckyDraws.length != 0) {
      //   for (let i = 0; i < luckyDraws.length; i++) {
      //     let avalilable = false;
      //     for (let j = 0; j < luckyDraws[i].skus.length; j++) {
      //       if (product_detail.id == luckyDraws[i].skus[j]) {
      //         avalilable = true;
      //         count++;
      //         break;
      //       }
      //     }
      //     if (avalilable) {
      //       let total_scanned = await CustomerProduct.count({
      //         where: {
      //           customer_id: { [Op.in]: sec_consumers_arr }
      //         }
      //       });
      //       if (total_scanned % luckyDraws[i].min_scanned_prod == 0) {
      //         await ScratchCardModel.create({
      //           id: uuid(),
      //           draw_id: luckyDraws[i].id,
      //           consumer_id: consumerId,
      //           qr_code: req.body.qr_code
      //         })
      //       }
      //     }

      //   }
      // }

      if (count == 1) {
        notificationController.AddNotification(req.consumerId, 'Gift Card', "You've won " + count + ' gift card', 1)
      }
      if (count > 1) {
        notificationController.AddNotification(req.consumerId, 'Gift Card', "You've won " + count + ' gift cards', 1)
      }

      return res.status(200).send({ success: 1, message: count + " Scratch card won!" })

    }
    catch (error) {
      console.log("error", error);
      logger.error(req, error);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },

  getScractchCard: async (req, res) => {
    try {
      let validator = new v(req.query, {
        card_id: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: "0", message: validatorError });
      }

      let tableUID = moment(req.createdAt).format('MM_YY')
      console.log(">>>>>tableUID", tableUID);
      let ScratchCardsModel = await DynamicModels.scratchCardsModel(tableUID);

      let cardDetails = await ScratchCardsModel.findOne({
        where: {
          id: req.query.card_id,
          is_scratched: false
        },
        raw: true
      })

      if (!cardDetails) {
        return res.status(200).send({ success: 0, message: "Scratch Card Not Found!" })
      }
      return res.status(200).send({ success: 1, data: cardDetails })
    } catch (error) {
      console.log(error);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },

  cardScratched: async (req, res) => {
    try {
      let validator = new v(req.body, {
        cardId: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: "0", message: validatorError });
      }

      let tableUID = moment(req.createdAt).format('MM_YY')
      console.log(">>>>>tableUID", tableUID);
      let ScratchCardsModel = await DynamicModels.scratchCardsModel(tableUID);

      let cardDetails = await ScratchCardsModel.findOne({
        where: {
          id: req.body.cardId,
          is_scratched: false
        },
        raw: true
      })

      if (!cardDetails) {
        return res.status(200).send({ success: 0, message: "Scratch Card Not Found!" })
      }

      if (req.roleId == 0) {
        await ConsumerModel.update({
          points: Sequelize.literal(`points + ${cardDetails.points}`),
          available_points: Sequelize.literal(`available_points + ${cardDetails.points}`),
        }, {
          where: {
            id: req.consumerId
          }
        })
      } else if (req.roleId == 1 || req.roleId == 2 || req.roleId == 3) {
        await ChannelPartners.update({
          points: Sequelize.literal(`points + ${cardDetails.points}`),
          available_points: Sequelize.literal(`available_points + ${cardDetails.points}`),
        }, {
          where: {
            id: req.consumerId
          }
        })
      }

      await ScratchCardsModel.update({
        is_scratched: true
      }, {
        where: {
          id: cardDetails.id
        }
      })

      if (cardDetails.points > 0) {
        notificationController.AddNotification(req.consumerId, cardDetails.points + ' Points', "You've won " + cardDetails.points + " points", 0);
      }
      return res.status(200).send({ success: 1, data: cardDetails })
    } catch (error) {
      console.log(error);
      return res.status(500).send({ success: 0, message: error.message });
    }
  },
  getAllScratchCards: async (req, res) => {
    try {

      let tableUID = moment(req.createdAt).format('MM_YY')
      console.log(">>>>>tableUID", tableUID);
      let ScratchCardsModel = await DynamicModels.scratchCardsModel(tableUID);
      ScratchCardsModel.hasOne(rewards, {
        foreignKey: "id",
        sourceKey: "reward_id",
      });
      ScratchCardsModel.hasOne(LuckyDraws, {
        foreignKey: "id",
        sourceKey: "scheme_id",
      });
      let scratchCards = await ScratchCardsModel.findAll({
        where: {
          customer_id: req.consumerId,
          is_discarded: false,
        },
        include: [
          {
            model: rewards,
            attributes: ['id', 'name', 'image'],
            as: rewards
          },
          {
            model: LuckyDraws,
            attributes: ['start_date', 'end_date'],
            as: LuckyDraws
          }
        ],
        order: [['createdAt', 'DESC']],
        raw: true,
        nest: true
      });
      // console.log("data>>>",scratchCards);
      scratchCards.forEach(card => {
        // console.log("card>>>",card);
        if (card.lucky_draw.start_date != undefined && card.lucky_draw.end_date != undefined) {
          const startDate = new Date(card.lucky_draw.start_date);
          const currDate = new Date()
          console.log("curr>>>", currDate);
          const endDate = new Date(card.lucky_draw.end_date)
          console.log("curr", currDate);
          console.log("end", endDate);

          // console.log("start date>>>>>",startDate);
          // console.log("end date>>>>>",endDate);

          const timeDifference = endDate - currDate;
          const daysDifference = Math.ceil(timeDifference / (1000 * 60 * 60 * 24)); // Convert milliseconds to days
          card.unlockIn = daysDifference;
          // console.log(`${daysDifference} days`);
        }
      });
      return res.status(200).send({ success: 1, data: scratchCards });
    } catch (error) {
      logger.error(req, error.message);
      console.log(error);
      return res.status(500).send({ success: 0, message: error.message })
    }
  },

  totalPoints: async (req, res) => {
    try {
      let consumerData = await ConsumerModel.findOne({
        where: {
          id: req.consumerId
        },
        raw: true
      })
      if (consumerData) {
        return res.status(200).send({ success: 1, total: consumerData.available_points, bonusPoints: consumerData.bonus_points });
      }
      let channerPartner = await ChannelPartners.findOne({
        where: {
          id: req.consumerId
        },
        raw: true
      })
      if (channerPartner) {
        console.log("-----data-----", channerPartner)
        return res.status(200).send({ success: 1, total: channerPartner.available_points, bonusPoints: channerPartner.bonus_points });
      }
      return res.status(200).send({ success: 0, message: "Data not found" });
    } catch (error) {
      logger.error(req, error.message);
      console.log(error);
      return res.status(500).send({ success: 0, message: error.message })
    }
  },


  allRegisteredProduct: async (req, res) => {
    try {

      let validator = new v(req.query, {
        startDate: "required",
        endDate: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let startDate = moment(req.query.startDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 00:00:00";
      let endDate = moment(req.query.endDate, "YYYY-MM-DD").format("YYYY-MM-DD") + " 23:59:59";

      console.log(">>>>>>>>>>>>>>>>>>>>>>startDate", startDate, ">>>>>>>>>>>endDate", endDate);
      let tableUID = moment(req.createdAt).format('MM_YY')
      console.log(">>>>>tableUID", tableUID);
      let CustomerProductModel = await DynamicModels.getCustomerProductsModel(tableUID);
      console.log("customModel >>>>>>>>", CustomerProductModel);
      //find All Registered Products
      let data = await CustomerProductModel.findAll({
        where: {
          customer_id: req.consumerId,
          createdAt: {
            [Op.between]: [startDate, endDate]
          },
        },
        attributes: ["createdAt", "unique_code"],
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: Product,
            attributes: ["id", "name", "main_image"]
          }
        ],
        raw: true,
        nest: true
      });
      if (data.length > 0) {
        return res.status(200).send({ success: 1, data: data })
      } else {
        return res.status(200).send({ success: 0 });
      }
    } catch (error) {
      logger.error(req, error.message);
      console.log("messs", error)
      return res.status(500).send({
        'success': '0',
        'message': error.message
      });
    }
  },

  getRewards: async (req, res) => {
    try {
      let roleId = req.roleId;
      let rewardlist = await rewards.findAll({
        where: {
          user_type: req.roleId,
          stock: { [Op.gt]: 0 },
          is_luckydraw_reward: false,
          is_deleted: false,
        },
        order: [['points', 'ASC']],
        raw: true
      })
      // console.log("reward list>>>",rewardlist);
      return res.status(200).send({ success: '1', data: rewardlist })

    }
    catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message });
    }
  },

  getAddress: async (req, res) => {
    try {
      let validator = new v(req.query, {
        // consumer_id: 'required'
      });

      ChannelPartners.hasOne(models.cityModel, {
        foreignKey: 'id',
        sourceKey: 'city_id'
      });

      ConsumerModel.hasOne(models.cityModel, {
        foreignKey: 'id',
        sourceKey: 'city_id'
      });

      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors })
      }

      let consumerDetail = await consumers.findOne({
        where: { id: req.consumerId },
        attributes: ['name', 'address', 'phone', 'pin_code', 'state_id', 'city_id',],
        include: [{
          model: models.cityModel,
          attributes: ["district_id"],
          raw: true,
          nest: true,
        }],
        raw: true
      })

      if (req.roleId == 1 || req.roleId == 2 || req.roleId == 3) {
        consumerDetail = await ChannelPartners.findOne({
          where: { id: req.consumerId },
          attributes: ['name', 'address', 'phone', 'pin_code', 'state_id', 'city_id'],
          include: [{
            model: models.cityModel,
            attributes: ["district_id"],
            raw: true,
            nest: true,
          }],
          raw: true
        });
      }
      console.log("user info>>>>>", consumerDetail);
      if (!consumerDetail) {
        return res.status(200).send({ success: '0', message: 'User Not Found' })
      } else {
        return res.status(200).send({ success: '1', data: consumerDetail })
      }
    }
    catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },

  redeemReward: async function (req, res) {
    try {
      console.log("req>>>>", req.consumerId, "----", req.createdAt);
      console.log("Reward Redeem Api ")
      let validator = new v(req.body, {
        reward_id: 'required',
        data: 'required'
      });

      console.log("data?>>>", req.body.data);
      // return
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      // let consumers_arry = [];
      let consumerDetail = await consumers.findOne({
        where: {
          id: req.consumerId
        },
        raw: true
      });

      if (req.roleId == 1 || req.roleId == 2 || req.roleId == 3) {
        consumerDetail = await ChannelPartners.findOne({
          where: {
            id: req.consumerId
          },
          raw: true
        });
      }

      if (!consumerDetail) {
        return res.status({
          success: '0',
          message: 'User Not Found'
        })
      }

      console.log("consumer found>>>>", consumerDetail);

      let total = 0;
      let customerAvailablePoints = consumerDetail.available_points;
      let customerBlockedPoints = consumerDetail.blocked_points;
      let cusotmerUtilizePoints = consumerDetail.utilize_points;

      total = customerAvailablePoints;

      console.log(">>>>>> Points info >>>>>>");
      console.log("Avail points >>>> ", customerAvailablePoints);
      console.log("Block points >>>>> ", customerBlockedPoints);
      console.log("Utilized points >>>>> ", cusotmerUtilizePoints);

      let rewardHistoryTableUID = moment(req.createdAt).format('YY')
      console.log(">>>>>tableUID", rewardHistoryTableUID);
      let customHistoryModel = await DynamicModels.rewardHistoryModel(rewardHistoryTableUID);
      console.log("customModel >>>>>>>>", customHistoryModel);

      let reward = await Reward.findOne({
        where: {
          id: req.body.reward_id,
          is_luckydraw_reward: false
        },
        raw: true,
        attributes: ['id', "points", "image", "name", "stock", "redeemed_stock", "is_luckydraw_reward", "is_wallet_based"]
      })
      console.log("reward>>>>", reward);
      console.log("reward id>>>>", req.body.reward_id);
      // check user already Claimed or not
      let alreadyApplied = await customHistoryModel.findOne({
        where: {
          reward_id: req.body.reward_id,
          consumer_id: req.consumerId,
          is_verified: 2
        },
        raw: true,
      });

      console.log("already find>>>>>", alreadyApplied);
      if (alreadyApplied) {
        return res.status(200).send({
          success: '0',
          message: 'You Have Already Claimed this'
        });
      }

      // check user already applied or not
      alreadyApplied = await customHistoryModel.findOne({
        where: {
          reward_id: req.body.reward_id,
          consumer_id: req.consumerId,
          is_verified: 0
        },
        raw: true,
      });

      if (alreadyApplied) {
        return res.status(200).send({
          success: '0',
          message: 'Please note that your previous request is currently under process. '
        });
      }

      let requiredPoints = reward.points;
      console.log("req_points", requiredPoints);

      if ((total) < reward.points) {
        return res.status(200).send({
          success: '0',
          message: 'Not Enough Points'
        })
      }

      if (reward.stock <= reward.redeemed_stock) {
        return res.status(200).send({
          success: '0',
          message: "Not Enough Stock"
        })
      } else {
        await rewards.update({
          redeemed_stock: (reward.redeemed_stock + 1)
        }, {
          where: {
            id: reward.id
          }
        })
      }

      let address = [];
      address[0] = req.body.data.address ? req.body.data.address : '';
      address[1] = req.body.data.address1 ? req.body.data.address1 : '';
      address[2] = req.body.data.address2 ? req.body.data.address2 : '';

      let rewardHistoryData = {
        id: uuid(),
        random_id: await randomstring.generate(15),
        // brand_id: Number(reward.dataValues.brand_id),
        reward_id: req.body.reward_id,
        consumer_id: req.consumerId,
        created_by: req.consumerId,
        is_verified: 0,
        // customer_name: req.body.data.name,
        customer_name: consumerDetail.name,
        address: address,
        pin_code: req.body.data.pincode,
        phone: req.body.data.country_code + req.body.data.phone,
        city_id: req.body.data.cityId,
        state_id: req.body.data.stateId,
        // email: req.body.data.email,
        email: consumerDetail.email,
        voucher_image: reward.image,
        points: reward.points,
        is_luckydraw_reward: reward.is_luckydraw_reward,
        role_id: req.roleId
      }


      let RewardHistory = await customHistoryModel.create(rewardHistoryData);

      // console.log("is_wallet_based",reward.is_wallet_based);
      if ((!reward.is_wallet_based) && (req.roleId == 0)) {
        if (requiredPoints <= total) {
          cut_points = requiredPoints;
          await consumers.update({
            available_points: Sequelize.literal(`available_points - ${cut_points}`),
            blocked_points: Sequelize.literal(`blocked_points + ${cut_points}`),
          }, {
            where: {
              id: req.consumerId
            }
          })
        }
      }
      else if ((!reward.is_wallet_based) && (req.roleId == 1 || req.role == 2 || req.roleId == 3)) {
        if (requiredPoints <= total) {
          cut_points = requiredPoints;
          await ChannelPartners.update({
            available_points: Sequelize.literal(`available_points - ${cut_points}`),
            blocked_points: Sequelize.literal(`blocked_points + ${cut_points}`),
          }, {
            where: {
              id: req.consumerId
            }
          })
        }
      }


      let pointsTransactionUID = moment(req.createdAt).format('YY')
      console.log("pointsTransactionUID", pointsTransactionUID);

      let customPointsTransactionModel = await DynamicModels.pointsTransactionModel(pointsTransactionUID);
      console.log("pointsTransactionUID >>>>>>>>", pointsTransactionUID);

      let pointsTransactionName;
      let cutPoints = 0;
      if (reward.is_wallet_based) {
        pointsTransactionName = "Wallet Based Scheme";
        cutPoints = 0;
      }
      else if (reward.is_luckydraw_reward) {
        pointsTransactionName = "Lucky Draw";
        cutPoints = 0;
      }
      else {
        pointsTransactionName = "On Purchase";
        cutPoints = reward.points;
      }

      let pointsTransactionData = {
        id: uuid(),
        name: pointsTransactionName, //onsignup, onpurchase, onlucydraw
        type: 0, // D/C => 0,1
        status: 1, // success,failed,rejected,pending (1 for success)
        reward_id: req.body.reward_id,
        // history_id: ,
        customer_id: req.consumerId,
        role_id: req.roleId,
        points: cutPoints,
      }

      await customPointsTransactionModel.create(pointsTransactionData);

      // let secondary_consumers = await secondaryConsumers.findAll({
      //   where: {
      //     dealer_id: req.consumerId
      //   },
      //   raw: true
      // });

      // consumers_arry = secondary_consumers.map(x => x.id);
      // consumers_arry.push(consumer_detail.id);


      // let customer_reward = await ProductReward.findAll({
      //   where: {
      //     customer_id: {
      //       [Op.in]: consumers_arry
      //     },
      //     is_scanned: true
      //   },
      //   attributes: [
      //     [Sequelize.fn('sum', Sequelize.col('point')), 'total']
      //   ],
      //   raw: true
      // });





      // let tableUID = moment(req.createdAt).format('MM_YY');
      // console.log(">>>>>tableUID", tableUID);
      // let CustomerProductModel = await DynamicModels.getCustomerProductsModel(tableUID);
      // console.log("customModel >>>>>>>>", CustomerProductModel);

      // let customer_reward = await CustomerProductModel.findAll({
      //   where: {
      //     customer_id: {
      //       [Op.in]: consumers_arry
      //     },
      //     // is_scanned: true
      //     is_reward_claimed: true
      //   },
      //   attributes: [
      //     [Sequelize.fn('sum', Sequelize.col('points')), 'total']
      //   ],
      //   raw: true
      // });
      // console.log("customer reward", customer_reward);

      // if (customer_reward.length != 0) {
      //   if (customer_reward.length > 0) {
      //     total = customer_reward[0].total;
      //   }

      // }

      // console.log("total>>>>",total);
      // dynamic history model year wise



      // let redeemed_reward = await customHistoryModel.findAll({
      //   where: {
      //     consumer_id: req.consumerId,
      //     is_verified: { [Op.in]: [0, 2, 3, 4] }
      //   },
      //   attributes: [
      //     [Sequelize.fn('sum', Sequelize.col('points')), 'total']
      //   ],
      //   raw: true
      // });


      // console.log("reddeem reward>>>",redeemed_reward);
      // if (redeemed_reward.length != 0) {
      //   total_redeemed = redeemed_reward[0].total;
      // }

      // total = total - total_redeemed;
      // console.log("total - total required", total, total_redeemed);

      // let stop_flag = false;
      // for (let i = 0; i < consumers_arry.length; i++) {
      //   if (stop_flag) {
      //     break;
      //   }
      //   let consumer_total = 0,
      //     cut_points = 0;
      //   let consumer_total_point = await CustomerProductModel.findAll({
      //     where: {
      //       customer_id: consumers_arry[i]
      //     },
      //     attributes: [
      //       [Sequelize.fn('sum', Sequelize.col('points')), 'total']
      //     ],
      //     raw: true,
      //   });

      //   if (consumer_total_point) {
      //     consumer_total = consumer_total_point[0].total
      //   }
      //   if (consumers_arry[i] != consumer_detail.id) {
      //     let consumer_redeem = 0;
      //     let consumer_redeemed_point = await Transactions.findAll({
      //       where: {
      //         sec_consumer_id: consumers_arry[i]
      //       },
      //       attributes: [
      //         [Sequelize.fn('sum', Sequelize.col('points')), 'total']
      //       ],
      //       raw: true
      //     });
      //     if (consumer_redeemed_point) {
      //       consumer_redeem = consumer_redeemed_point[0].total;
      //     }
      //     consumer_total = consumer_total - consumer_redeem;

      //     if (required_points >= consumer_total) {
      //       cut_points = consumer_total
      //     } else {
      //       cut_points = required_points
      //       stop_flag = true
      //     }
      //     if (cut_points) {
      //       await Transactions.create({
      //         id: uuid(),
      //         reward_id: reward.id,
      //         history_id: RewardHistory.id,
      //         pri_consumer_id: consumer_detail.id,
      //         sec_consumer_id: consumers_arry[i],
      //         points: cut_points
      //       })
      //     }

      //   } else {

      //     let consumer_redeem = 0;
      //     let consumer_redeemed_point = await Transactions.findAll({
      //       where: {
      //         pri_consumer_id: consumers_arry[i]
      //       },
      //       attributes: [
      //         [Sequelize.fn('sum', Sequelize.col('points')), 'total']
      //       ],
      //       raw: true
      //     });

      //     if (consumer_redeemed_point) {
      //       consumer_redeem = consumer_redeemed_point[0].total;
      //     }
      //     consumer_total = consumer_total - consumer_redeem;

      //     if (required_points >= consumer_total) {
      //       cut_points = consumer_total
      //     } else {
      //       cut_points = required_points
      //     }

      //     if (cut_points > 0) {
      //       await Transactions.create({
      //         id: uuid(),
      //         reward_id: reward.id,
      //         history_id: RewardHistory.id,
      //         pri_consumer_id: consumer_detail.id,
      //         points: cut_points
      //       })
      //     }
      //   }

      // }

      return res.status(200).send({
        'success': '1',
        'data': RewardHistory
      });
    } catch (ex) {
      console.log(ex);
      logger.error(req, ex);
      return res.status(500).send({
        'success': '0',
        'message': ex
      });
    }
  },

  luckyRewardRedeem: async (req, res) => {
    try {
      let validator = new v(req.body, {
        card_id: 'required',
        data: 'required'
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({
          success: '0',
          message: validator.errors
        })
      }
      let consumerId = req.consumerId;

      let consumerDetail = await consumers.findOne({
        where: {
          id: req.consumerId
        },
        raw: true
      });

      if (req.roleId == 1 || req.roleId == 2 || req.roleId == 3) {
        consumerDetail = await ChannelPartners.findOne({
          where: {
            id: req.consumerId
          },
          raw: true
        });
      }

      if (!consumerDetail) {
        return res.status({
          success: '0',
          message: 'User Not Found'
        })
      }

      console.log("consumer found>>>>", consumerDetail);

      //find card detail
      let tableUID = moment(req.createdAt).format('MM_YY')
      console.log(">>>>>tableUID", tableUID);
      let ScratchCardsModel = await DynamicModels.scratchCardsModel(tableUID);
      console.log("model >>>", ScratchCardsModel);


      let card = await ScratchCardsModel.findOne({
        where: {
          customer_id: consumerId,
          id: req.body.card_id,
          is_discarded: false,
        }
      });

      if (card) {
        await ScratchCardsModel.update({
          is_discarded: true
        }, {
          where: {
            id: req.body.card_id
          }
        });
      } else {
        return res.status(200).send({
          success: '0',
          message: 'Card not found'
        })
      }
      console.log("reward>>>", card);
      let reward = await Reward.findOne({
        where: {
          id: card.reward_id,
          is_luckydraw_reward: true
        },
        raw: true,
        attributes: ['id', "points", "image", "name", "stock", "redeemed_stock", "is_luckydraw_reward"]
      })

      if (reward.stock <= reward.redeemed_stock) {
        return res.status(200).send({
          success: '0',
          message: "Not Enough Stock"
        })
      }
      // else {
      //   await rewards.update({
      //     redeemed_stock: (reward.redeemed_stock + 1)
      //   }, {
      //     where: {
      //       id: reward.id
      //     }
      //   })
      // }

      let address = [];
      address[0] = req.body.data.address ? req.body.data.address : '';
      address[1] = req.body.data.address1 ? req.body.data.address1 : '';
      address[2] = req.body.data.address2 ? req.body.data.address2 : '';

      console.log("card.scheme_id>>>>>>>>", card.scheme_id)
      let LuckyDrawRewardHistoryData = {
        id: uuid(),
        random_id: await randomstring.generate(15),
        // brand_id: Number(reward.dataValues.brand_id),
        reward_id: card.reward_id,
        consumer_id: req.consumerId,
        created_by: req.consumerId,
        is_verified: 0,
        customer_name: consumerDetail.name,
        address: address,
        pin_code: req.body.data.pincode,
        phone: req.body.data.country_code + req.body.data.phone,
        city_id: req.body.data.cityId,
        state_id: req.body.data.stateId,
        // email: req.body.data.email,
        email: consumerDetail.email,
        voucher_image: reward.image,
        is_luckydraw_reward: true,
        role_id: req.roleId,
        scheme_id: card.scheme_id,
      }

      // let Object = {
      //   id: uuid(),
      //   random_id: await randomstring.generate(15),
      //   // brand_id: Number(reward.dataValues.brand_id),
      //   reward_id: card.reward_id,
      //   consumer_id: consumerId,
      //   created_by: consumerId,
      //   is_verified: 0,
      //   customer_name: req.body.data.name,
      //   address: req.body.data.address,
      //   pin_code: req.body.data.pincode,
      //   phone: req.body.data.phone,
      //   email: req.body.data.email,
      //   is_luckydraw_reward: true
      // }

      // await RewardRedeemHistoryData.create(Object);
      let rewardHistoryTableUID = moment(req.createdAt).format('YY')
      console.log(">>>>>tableUID", rewardHistoryTableUID);
      let customHistoryModel = await DynamicModels.rewardHistoryModel(rewardHistoryTableUID);
      console.log("customModel >>>>>>>>", customHistoryModel);

      let RewardHistory = await customHistoryModel.create(LuckyDrawRewardHistoryData);

      return res.status(200).send({
        success: '1',
        message: 'Successfully redeemed'
      })
    } catch (error) {
      return res.status(500).send({
        success: '0',
        message: error.message
      })
    }

  },

  rewardHistoryList: async function (req, res) {
    try {
      console.log("in reedem", req.query);
      let rewardHistoryTableUID = moment(req.createdAt).format('YY')
      console.log(">>>>>tableUID", rewardHistoryTableUID);
      let customHistoryModel = await DynamicModels.rewardHistoryModel(rewardHistoryTableUID);
      console.log("customModel >>>>>>>>", customHistoryModel);
      // associations

      customHistoryModel.hasOne(consumers, {
        foreignKey: 'id',
        sourceKey: 'consumer_id',
      });

      customHistoryModel.hasOne(rewards, {
        foreignKey: 'id',
        sourceKey: 'reward_id',
      });

      customHistoryModel.findAll({
        where: {
          consumer_id: req.consumerId,
        },
        attributes: ['id', 'consumer_id', 'phone', 'email', 'address', 'reward_id', 'createdAt', 'is_verified', 'verify_comments', 'random_id', 'points', 'voucher_image'],
        include: [{
          model: rewards,
          as: rewards,
          attributes: ['id', 'name', 'points', 'reward_id', 'name', 'is_wallet_based'],
          required: true
        }, {
          model: consumers
        }],
        order: [
          ['createdAt', 'DESC']
        ]

      })
        .then(rewardredeemhistory => {
          if (rewardredeemhistory) {
            res.status(200).send({
              "success": "1",
              "data": rewardredeemhistory
            });
          } else {
            res.status(200).send({
              "success": "0",
              "message": message
            });
          }
        })
        .catch(err => {
          console.log("inner eror", err);
          res.status(500).send({
            'success': '0',
            'message': err
          })
        });

    } catch (ex) {
      console.log("reedem history error", ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        'success': '0',
        'message': ex
      });
    }
  },

  loyaltyOffers: async (req, res) => {
    try {
      let roleId = req.roleId;
      let whereClause = {
        consumer_type: req.roleId,
        esign_status: 2,
        [Op.or]: [
          {
            type: 2  /// infinite
          },
          {
            type: 1,
            end_date: {
              [Op.gte]: new Date()
            }
          }
        ],
        is_deleted: false,
      }
      let cityDetail = await models.cityModel.findOne({ where: { id: req.cityId }, raw: true });

      //get region Details history id
      let regionIds = [];
      let zoneChildHistoryDetails = await models.zoneChildMasterModel.findAll({
        where: {
          cities: { [Op.overlap]: [cityDetail.district_id] },
        },
        attributes: ['zone_history_id'],
        order: [["createdAt", "DESC"]],
        raw: true
      })

      if (zoneChildHistoryDetails.length > 0) {
        regionIds = zoneChildHistoryDetails.map(x => x.zone_history_id);
        // return res.status(200).send({ success: 0, message: "Better Luck Next Time!" })
      }

      //get territory Details history idcmd
      let territoryIds = [];
      let territoryHistoryDetails = await models.territoryHistoryMasterModel.findAll({
        where: {
          villages: { [Op.overlap]: [cityDetail.id] },
        },
        attributes: ['id'],
        order: [["createdAt", "DESC"]],
        limit: 5,
        raw: true
      })

      if (territoryHistoryDetails.length > 0) {
        territoryIds = territoryHistoryDetails.map(x => x.id);
        // return res.status(200).send({ success: 0, message: "Please Update Your City To Get Rewards!" })
      }

      //get zone Details history id
      let zoneIds = [];
      let zoneHistoryDetails = await models.parentZoneHistoryMasterModels.findAll({
        where: {
          states: { [Op.overlap]: [cityDetail.state_id] },
        },
        attributes: ['id'],
        order: [["createdAt", "DESC"]],
        raw: true
      })

      if (zoneHistoryDetails.length > 0) {
        zoneIds = zoneHistoryDetails.map(x => x.id);
        // return res.status(200).send({ success: 0, message: "Please Update Your City To Get Rewards!" })
      }

      if ([0, 1, 2, 3].includes(req.roleId)) {
        whereClause[Op.or] = [
          { regions: { [Op.overlap]: regionIds } },
          { territories: { [Op.overlap]: territoryIds } },
          { zones: { [Op.overlap]: zoneIds } },
        ];
      }
      let allLoyaltyPoints = await PointAllocation.findAll({
        where: whereClause,
        // include: [
        //   {
        //     model: Product,
        //     attributes: ['name'],
        //   },
        // ],
        raw: true,
        nest: true
      });

      let data = [];

      for (let item of allLoyaltyPoints) {

        let maxPoints = 0;
        let flag = false
        if ((item.type == 1 && (item.start_date <= new Date() && item.end_date >= new Date())) || item.type == 2) {
          flag = true
          //calculate max points for percentage mode
          if (item.mode == 1) {
            maxPoints = item.percentage + '%';
          }
          //calculate max points for dynamic allocation
          if (item.mode == 2) {
            maxPoints = item.max
          }


          let obj = {
            // product: item.product.name,
            scheme_image: item.scheme_image,
            max_points: maxPoints,
            lvl: item.lvl_type,
            name: item.name,

          }
          data.push(obj)
        }
      }

      return res.status(200).send({ success: '1', data: data })
    }
    catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }

  },

  offers: async (req, res) => {
    try {
      let roleId = req.roleId;
      let whereClause = {
        consumer_type: roleId,
        // start_date: { [Op.lte]: new Date() },
        end_date: { [Op.gte]: new Date() },
        status: 1
      }
      let cityDetail = await models.cityModel.findOne({ where: { id: req.cityId }, raw: true });

      //get region Details history id
      let regionIds = [];
      let zoneChildHistoryDetails = await models.zoneChildMasterModel.findAll({
        where: {
          cities: { [Op.contains]: [cityDetail.district_id] },
        },
        attributes: ['zone_history_id'],
        order: [["createdAt", "DESC"]],
        raw: true
      })

      if (zoneChildHistoryDetails.length > 0) {
        regionIds = zoneChildHistoryDetails.map(x => x.zone_history_id);
        // return res.status(200).send({ success: 0, message: "Better Luck Next Time!" })
      }

      //get territory Details history idcmd
      let territoryIds = [];
      let territoryHistoryDetails = await models.territoryHistoryMasterModel.findAll({
        where: {
          villages: { [Op.contains]: [cityDetail.id] },
        },
        attributes: ['id'],
        order: [["createdAt", "DESC"]],
        limit: 1,
        raw: true
      })

      if (territoryHistoryDetails.length > 0) {
        territoryIds = territoryHistoryDetails.map(x => x.id);
        // return res.status(200).send({ success: 0, message: "Please Update Your City To Get Rewards!" })
      }

      //get zone Details history id
      let zoneIds = [];
      let zoneHistoryDetails = await models.parentZoneHistoryMasterModels.findAll({
        where: {
          states: { [Op.contains]: [cityDetail.state_id] },
        },
        attributes: ['id'],
        order: [["createdAt", "DESC"]],
        raw: true
      })

      if (zoneHistoryDetails.length > 0) {
        zoneIds = zoneHistoryDetails.map(x => x.id);
        // return res.status(200).send({ success: 0, message: "Please Update Your City To Get Rewards!" })
      }

      if ([0, 1, 2, 3].includes(req.roleId)) {
        whereClause[Op.or] = [
          { regions: { [Op.overlap]: regionIds } },
          { territories: { [Op.overlap]: territoryIds } },
          { zones: { [Op.overlap]: zoneIds } },
        ];
      }

      //Find All Offers
      let luckyDraws = await LuckyDraws.findAll({
        where: whereClause,
        attributes: ["id", "draw_name", "draw_desc", "image", "t_and_c", "scheme_image"]
      });

      let luckyDrawsArr = [];
      for (let draw of luckyDraws) {
        let obj = {
          id: draw.id,
          draw_name: draw.draw_name,
          draw_desc: draw.draw_desc,
          image: draw.image,
          scheme_image: draw.scheme_image
        }
        if (draw.t_and_c != null) {
          obj.t_and_c = draw.t_and_c;
        }
        luckyDrawsArr.push(obj);
      }
      //get All Point Allocation
      // let points = await PointAllocation.findAll({
      //   where: {
      //     is_deleted: false,
      //     consumer_type: roleId,
      //   },
      //   include: [{
      //     model: Product,
      //     attributes: ['name'],
      //     // include: [
      //     //     {
      //     //         model: StyleCode,
      //     //         raw: true,
      //     //         attributes: ["id", "mrp"],
      //     //     }
      //     // ]
      //   },

      //   ],
      //   raw: true,
      //   nest: true
      // });
      // let pointAll = [];
      // // console.log("all points********", points);

      // for (let all of points) {
      //   // console.log("all.mode", all.mode);
      //   let maxPoints = 0;
      //   let flag = false
      //   if ((all.type == 1 && (all.start_date <= new Date() && all.end_date >= new Date())) || all.type == 2) {
      //     flag = true
      //   }
      //   //calculate max points for percentage mode
      //   if (all.mode == 1 && flag) {
      //     // if (all.product.x_company_style_code.mrp &&) {
      //     //     let temp = (all.percentage * all.product.x_company_style_code.mrp) / 100;
      //     //     maxPoints = Math.ceil(temp);
      //     // }
      //     // else {
      //     maxPoints = all.percentage + '%';
      //     let obj = {
      //       product: all.product.name,
      //       max_points: maxPoints,
      //       lvl: all.lvl_type
      //     }
      //     pointAll.push(obj)
      //     // }
      //   }

      //   //calculate max points for dynamic allocation
      //   if (all.mode == 2 && flag) {
      //     maxPoints = all.max
      //   }
      //   let obj = {
      //     product: all.product.name,
      //     max_points: maxPoints,
      //     lvl: all.lvl_type
      //   }

      //   if (maxPoints > 0) {
      //     pointAll.push(obj)
      //   }
      // }
      // console.log("points********", pointAll);

      // let data = { luckyDraw: luckyDrawsArr, pointAllocation: pointAll }
      let data = { luckyDraw: luckyDrawsArr }
      return res.status(200).send({ success: '1', data: data })
    }
    catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }

  },
  getCustomerDetail: async (req, res) => {
    try {
      ChannelPartners.hasOne(models.cityModel, {
        foreignKey: 'id',
        sourceKey: 'city_id'
      });

      ConsumerModel.hasOne(models.cityModel, {
        foreignKey: 'id',
        sourceKey: 'city_id'
      });

      // for channel partner
      let channelPartner = await ChannelPartners.findOne({
        where: {
          id: req.consumerId,
          is_deleted: false
        },
        include: [{
          model: models.cityModel,
          attributes: ["district_id"],
          raw: true,
          nest: true,
        }],
        raw: true
      });
      if (channelPartner) {
        let token = await jwt.sign({ user_token: ChannelPartners.id },
          require("../config/secret")(),
          {
            algorithm: "HS256",
            expiresIn: "7d"
          });
        channelPartner.jwt_token = token;
        let encryptedData = CryptoJS.AES.encrypt(JSON.stringify(channelPartner), process.env.PWASecretKey).toString();
        return res.status(200).send({ success: '1', data: encryptedData })
      }
      else {
        let consumerDetails = await ConsumerModel.findOne({
          where: {
            id: req.consumerId,
            // phone: req.query.phone,
            // country_code: req.query.country_code,
            // is_deleted: false // column removed
          },
          include: [{
            model: models.cityModel,
            attributes: ["district_id"],
            raw: true,
            nest: true,
          }],
          raw: true
        });
        if (consumerDetails) {
          let token = await jwt.sign({ user_token: consumerDetails.id },
            require("../config/secret")(),
            {
              algorithm: "HS256",
              expiresIn: "7d"
            });
          consumerDetails.jwt_token = token;
          let encryptedData = CryptoJS.AES.encrypt(JSON.stringify(consumerDetails), process.env.PWASecretKey).toString();
          return res.status(200).send({ success: '1', data: encryptedData })
        } else {
          return res.status(200).send({ success: '0', message: 'invalid phone no' })
        }
      }
    } catch (ex) {
      console.log(ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },

  luckyDrawUnlockedInfo: async (req, res) => {
    try {
      let tableUID = moment(req.createdAt).format('MM_YY');
      console.log(">>>>>tableUID", tableUID);
      let ScratchCardsModel = await DynamicModels.scratchCardsModel(tableUID);

      ScratchCardsModel.hasOne(LuckyDraws, {
        foreignKey: "id",
        sourceKey: "scheme_id",
      });

      let scratchCards = await ScratchCardsModel.findAll({
        where: {
          customer_id: req.consumerId,
          // is_discarded: false,
          card_type: 2,
          // is_locked: false
          is_locked: true,


        },
        include: [
          {
            model: LuckyDraws,
            attributes: ['start_date', 'end_date'],
            as: LuckyDraws
          }
        ],
        order: [['createdAt', 'DESC']],
        raw: true,
        nest: true
      });

      return res.status(200).send({ success: 1, data: scratchCards });
    } catch (ex) {
      console.log(ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
  ////To be Deleted
  addRewards: async (req, res) => {
    try {
      let validator = new v(req.body, {
        // consumer_id: "required",
        product_id: "required",
        code_id: "required",
        // qr_code: "required",
        uniqueCode: "required",
        // latitude: "required",
        // longitude: "required"
      });
      console.log("req body", req.body);

      let matched = await validator.check();
      if (!matched) {
        return res
          .status(200)
          .send({
            success: "0",
            message: validator.errors
          });
      }

      let productData = await Product.findOne({
        where: {
          id: req.body.product_id
        },
        raw: true,
        nest: true,
        attributes: ["id"],
        include: [{
          model: ProductCategory,
          as: 'categories',
          attributes: ["id"],
          raw: true,
          nest: true,
          // include: [{
          //   model: CompanyBrands,
          //   raw: true,
          //   attributes: ["id"]
          // }]
        }]
      })
      if (!productData) {
        return res.status(200).send({ success: "0", message: "Product not found" });
      }

      let consumerId = req.consumerId;
      let roleId = req.roleId;

      // let product_uid = req.body.qr_code.substring(2, 5);
      // let level = req.body.qr_code.substring(5, 6);

      console.log("Unique code in  req.body >>>>>>", req.body.uniqueCode);
      let getLevelUID = await getUIDAndLevel(req.body.uniqueCode);
      let product_uid = getLevelUID.UID;
      let level = getLevelUID.level;


      let lvl_type = 1;
      let trusted_qrcode = '';
      console.log("level found>>>", level);
      console.log(req.body.qr_code, product_uid, '>>>>>>>>>>>>>>>>');
      //let table_id = "trusted_qrcodes_" + product_uid.toLowerCase();
      if (level == 'P') {
        trusted_qrcode = await DynamicModels.getPrimaryQRCodesModel(product_uid.toLowerCase());
      } else if (level == 'S') {
        trusted_qrcode = await DynamicModels.getSecondaryQRCodesModel(product_uid.toLowerCase());
      } else if (level == 'T') {
        trusted_qrcode = await DynamicModels.getTertiaryQRCodesModel(product_uid.toLowerCase());
      } else if (level == 'O') {
        trusted_qrcode = await DynamicModels.getOuterQRCodesModel(product_uid.toLowerCase());
      }

      trusted_qrcode.hasOne(Product, {
        foreignKey: 'id',
        sourceKey: 'product_id'
      });
      let uniqueCode = req.body.uniqueCode;
      console.log("unique code >>>>> ", uniqueCode);

      let codeDetails;
      console.log("trustedcode >>>>>", trusted_qrcode);
      //Find Qrcode details
      console.log("level_type is >>>>>", lvl_type);
      if (lvl_type == 1) {
        codeDetails = await trusted_qrcode.findOne({
          where: {
            // [Op.or]: [{ qr_code: req.body.qr_code }/*, { tft_trusted_qrcode: req.body.qr_code }*/],
            [Op.or]: [{ unique_code: uniqueCode }],
            // is_active: true
          },
          raw: true,
          nest: true,
          include: [{
            model: Product,
            as: 'product',
            raw: true,
            attributes: ['id', 'mrp']
          }],
          attributes: ["id", "unique_code", "qr_code"]
        })
      } /*else if (lvl_type == 4) {
        codeDetails = await ParentQRCode.findOne({
          where: {
            unique_code: req.body.qr_code
          },
          raw: true
        })
      } else {
        return res.status(200).send({ success: '0', message: '0' })
      }*/
      console.log("code details found >>>>", codeDetails);
      if (!codeDetails) {
        return res.status(200).send({ success: '0', message: 'QR Code Not Found' })
      }

      console.log("roleId", roleId, codeDetails.id);

      //Scan History find
      let dynamicCustomerProduct;
      // if (level == P) {
      //   dynamicCustomerProduct = 'customer_product_' + level;
      // } else if (level == S) {
      //   dynamicCustomerProduct = 'customer_product_' + level;
      // } else if (level == T) {
      //   dynamicCustomerProduct = 'customer_product_' + level;
      // } else if (level == O) {
      //   dynamicCustomerProduct = 'customer_product_' + level;
      // }


      let currDate = new Date();
      let currMonth = currDate.getMonth();
      console.log("curr month >>>> ", currMonth);
      currMonth = currMonth > 9 ? currMonth : `0${currMonth}`; // MM formate
      const currYear = currDate.getFullYear().toString().substr(-2); // YY formate
      let UID = `${currMonth}_${currYear}`;
      dynamicCustomerProduct = await DynamicModels.getCustomerProductsModel(UID);

      console.log("customModel >>>>>>>>", dynamicCustomerProduct);



      let customerProduct = await dynamicCustomerProduct.findOne({
        where: {
          consumer_type: roleId,
          code_id: codeDetails.id,
          customer_id: req.consumerId
        },
        raw: true
      })
      console.log(">>>", customerProduct);
      if (!customerProduct) {
        return res.status(200).send({ success: '0', message: 'Not Scanned' })
      }

      let cityId = customerProduct.city_id;

      let city = await City.findOne({
        where: {
          id: cityId
        },
        raw: true,
        attributes: ['id', 'state_id']
      });

      //find city id from customerProduct
      //Find State From Lat Long
      console.log("customerProducts", customerProduct);
      console.log("stateeeeeee", city.state_id)
      let stateId = [];
      stateId.push(city.state_id);
      console.log("codeDetailss", codeDetails);
      let newDate = new Date();
      let point = 5;
      // let pointAllocate = await PointAllocation.findOne({
      //   where: {
      //     consumer_type: roleId,
      //     lvl_type: lvl_type,
      //     states: { [Op.contains]: stateId },
      //     [Op.or]: [
      //       {
      //         type: 2  /// infinite
      //       },
      //       {
      //         [Op.and]: [{
      //           type: 1
      //         }, {
      //           start_date: {
      //             [Op.lte]: newDate
      //           }
      //         }, {
      //           end_date: {
      //             [Op.gte]: newDate
      //           }
      //         }]
      //       }
      //     ],
      //     // sku_id: codeDetails.product_style.product_id,
      //     // sku_id: codeDetails.product.id, // error chances
      //     is_deleted: false
      //   },
      //   raw: true
      // });
      // console.log("b point all", pointAllocate);

      // if (pointAllocate) {
      //   if (pointAllocate.mode == 1) {
      //     if (pointAllocate.percentage) {
      //       let f_lvl = 1,
      //         s_lvl = 1;
      //       let product = await Product.findOne({
      //         where: {
      //           id: codeDetails.product.id
      //         },
      //         raw: true,
      //         attributes: ['id']
      //       });
      //       console.log("after point all");

      //       if (product) {
      //         if (product.fst_inner_size != null) {
      //           f_lvl = product.fst_inner_size
      //         }
      //         if (product.snd_inner_size != null) {
      //           s_lvl = product.snd_inner_size
      //         }
      //         if (pointAllocate.lvl_type == 1) {
      //           point = ((codeDetails.product.mrp * pointAllocate.percentage) / 100).toFixed(0);
      //         } else {
      //           point = ((codeDetails.product.mrp * f_lvl * s_lvl * pointAllocate.percentage) / 100).toFixed(0);
      //         }
      //       }
      //     }
      //   } else {
      //     point = getRandomIntInclusive(pointAllocate.min, pointAllocate.max); // need to implement
      //   }
      //   notifications.AddNotification(req.consumerId, point + ' Points', "You've won " + point + " points", 0)

      // }

      let productReward = await dynamicCustomerProduct.findOne({
        where: {
          consumer_type: roleId,
          product_id: codeDetails.product.id,
          code_id: codeDetails.id,
          // [Op.or]: [{ code: codeDetails.qr_code }/*, { code: codeDetails.tft_trusted_qrcode }*/],
          customer_id: req.consumerId  // Anticounterfeiting
        }
      });
      console.log("p rrr", productReward);
      if (!productReward.point_allocated) {
        let rewards = dynamicCustomerProduct.update({
          points: point,
          // reward_id: uuid.v4()
        }, {
          where: {
            id: productReward.id
          },
          raw: true
        })
        let success = 1;
        return res.status(200).send({
          'success': success,
          message: "Customer rewards collected successfully",
          points: point,
          // rewards: rewards
        })
      } else {
        return res.status(200).send({
          success: 0,
          message: "reward already collected"
        });
      }
      // if (productReward == null) {
      //   let rewards = await ProductReward.create({
      //     id: uuid.v4(),
      //     customer_id: consumerId,
      //     consumer_type: roleId,
      //     product_id: codeDetails.product_style.product_id,
      //     code_id: codeDetails.id,
      //     point: point,
      //     code: req.body.qr_code,
      //     is_scanned: false,
      //     createdAt: new Date(),
      //     updatedAt: new Date(),
      //     category_id: productData.product_category.id,
      //     brand_id: productData.product_category.company_brand.id
      //   })
      //   let success = 1;
      //   // if (pointAllocate) {
      //   //     success = 1
      //   // }
      //   return res.status(200).send({
      //     'success': success,
      //     message: "Customer rewards collected successfully",
      //     point: point,
      //     rewards: rewards
      //   })
      // } else {
      //   return res.status(200).send({
      //     success: 0,
      //     message: "reward already collected"
      //   });
      // }
    } catch (ex) {
      console.log("error bcknd", ex);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },

  updateScratchCard: async (req, res) => {
    try {
      console.log("API Hit")
      let validator = new v(req.body, {
        card_id: 'required'
      });
      let consumerId = req.consumerId;
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors })
      }

      //find card detail
      let tableUID = moment(req.createdAt).format('MM_YY')
      console.log(">>>>>tableUID", tableUID);
      let ScratchCardsModel = await DynamicModels.scratchCardsModel(tableUID);
      console.log("DataBase name >>>", ScratchCardsModel);

      let cardDetail = await ScratchCardsModel.findOne({
        where: {
          id: req.body.card_id,
          customer_id: consumerId
        },
        raw: true
      })

      if (!cardDetail) {
        return res.status(200).send({ success: '0', message: "card not found" })
      }
      console.log("card data found>>>>", cardDetail);
      //update scratch card details
      let updateClause = {
        is_scratched: true
      }
      if (cardDetail.reward_id == null) {
        updateClause = {
          is_scratched: true,
          is_discarded: true
        }
      } else {
        let reward = await rewards.findOne({
          where: {
            id: cardDetail.reward_id
          },
          attributes: ['id', 'name']
        })
        if (reward) {
          notificationController.AddNotification(req.consumerId, reward.name, "You've won " + reward.name + " from gift card", 3)
        }
      }
      await ScratchCardsModel.update(
        updateClause,
        {
          where: {
            id: req.body.card_id,
            customer_id: consumerId
          }
        });

      //find consumer Details 
      // let consumer_detail = await consumers.findOne({
      //     where: {
      //         id: consumerId
      //     },
      //     attributes: ["id", "name", "phone", "address", "pin_code"]
      // });
      // if (!consumer_detail) {
      //     return res.status(200).send({ success: '0', message: 'Consumer not found' })
      // }

      //find reward Details
      // let rewardDetail = await rewards.findOne({
      //     where: {
      //         id: card_detail.reward_id,
      //         is_deleted: false
      //     },
      //     raw: true
      // })
      // if (!rewardDetail) {
      //     return res.status(200).send({ success: '0', message: 'Reward Not Found' })
      // }

      //make new redeem history
      // if (card_detail.reward_id) {
      //     await rewardRedeemHistory.create({
      //         id: uuid(),
      //         cutomer_name: consumer_detail.name,
      //         phone: consumer_detail.phone,
      //         reward_id: card_detail.reward_id,
      //         consumer_id: consumerId,
      //         is_verified: 0,
      //     })
      // }
      return res.status(200).send({ success: '1', message: "updated" })
    }
    catch (error) {
      logger.error(req, error.message);
      console.log("backend error>>", error);
      return res.status(500).send({ success: '0', message: error })
    }
  },

  addProductRegister: async (req, res) => {
    try {
      let consumerId = req.consumerId;
      let roleId = req.roleId;
      console.log("req.roleId", req.roleId);
      console.log("req.consumerId>>>>", req.consumerId);
      let validator = new v(req.body, {
        // latitude: "required",
        // longitude: "required",
        product_id: "required",
        // shortCode: "required",
        uniqueCode: "required",
        // code_id: "required",
        customer_id: "required",
        batchId: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        return res
          .status(200)
          .send({
            success: "0",
            message: validator.errors
          });
      }

      let productData = await Product.findOne({
        where: {
          id: req.body.product_id
        },
        raw: true,
        nest: true,
        attributes: ["id"],
        include: [{
          model: ProductCategory,
          attributes: ["id"],
          as: 'categories',
          raw: true,
          nest: true
        }]
      })
      if (!productData) {
        return res.status(200).send({ success: "0", message: "Product not found" });
      }

      console.log("productData>>>>>>>>>", productData);
      // req.body.latitude = 23.068677461884355;
      // req.body.longitude = 72.54202099360181;

      let locationDetails = await LocationTracker.trackLocation(req.body.latitude, req.body.longitude);

      console.log("cdata h kya", consumerId);
      let consumerDetails = await consumers.findOne({
        where: {
          id: consumerId
        },
        raw: true,
        attributes: ["id", "city_id"]
      })
      console.log("req.body.uniqueCode", req.body.uniqueCode);
      console.log("consumerDetails>>>>>>>>>>>>>>", consumerDetails);
      let getlevel = await getUIDAndLevel(req.body.uniqueCode);
      let CustomModel = await getDynamicModel(getlevel.level, getlevel.UID);
      console.log("customModel", CustomModel);
      let codeDetail;
      codeDetail = await CustomModel.findOne({
        where: {
          unique_code: req.body.uniqueCode,
          // is_active: true
        },
        raw: true,
        nest: true
      });
      if (!codeDetail) {
        return res.status(200).send({ success: 0, message: "Code id Not found" })
      }

      // console.log("getlevel",getlevel.level);
      if (!consumerDetails) {
        return res.status(200).send({ success: 0, message: "User Not found" })
      }

      let data = {
        id: uuid(),
        customer_id: consumerId,
        consumer_type: roleId,
        category_id: productData.categories.id || 1,
        product_id: req.body.product_id,
        batch_id: req.body.batchId, // null 
        code_id: codeDetail.id,
        unique_code: req.body.uniqueCode,
        level: getlevel.level,
        // points : 
        // is_reward_claimed:
        city_id: consumerDetails.city_id,

        //register_by: 2,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
      };

      if (locationDetails.status) {
        data.latitude = locationDetails.data.storeLat;
        data.longitude = locationDetails.data.storeLng;
      }

      if (req.roleId && (req.roleId == 3)) {
        data.is_internal_user = true;
      }

      let currDate = new Date();
      let currMonth = currDate.getMonth();
      currMonth = currMonth > 9 ? currMonth : `0${currMonth}`; // MM formate
      const currYear = currDate.getFullYear().substr(-2).toString(); // YY formate
      let UID = `${currMonth}_${currYear}`;
      let CustomerProductsModel = await DynamicModels.getCustomerProductsModel(UID);

      console.log("custommodel>>>>>>>>", CustomerProductsModel);
      let already_registered = await CustomerProductsModel.findOne({
        where: {
          customer_id: req.body.customer_id,
          consumer_type: roleId,
          unique_code: req.body.uniqueCode
        }
      });
      if (already_registered) {
        return res.status(200).send({ success: '0', message: 'Already Registered' })
      }

      await CustomerProductsModel.create(data);
      // await dynamicCustomerProduct.create(data);

      return res.status(200).send({
        success: 1,
        message: "Product registered successfully"
      });

    } catch (ex) {
      console.log("error in register product", ex);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
  findByQrCode: async (req, res) => {
    try {
      let validator = new v(req.query, {
        unique_code: 'required'
      })
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate((validator.errors))
        return res.status(200).send({ success: '0', message: validatorError })
      }
      console.log("req.query.unique_code >>>>>", req.query.unique_code);
      let UIDAndLevel = await getUIDAndLevel(req.query.unique_code);

      console.log("UIDAndLevel >>>>>> ", UIDAndLevel);
      let level = UIDAndLevel.level;
      let uid = UIDAndLevel.UID;

      console.log("level :: ", level);
      console.log("UID :: ", uid);

      let key = level;
      let UID = uid;

      let CustomModel = await getDynamicModel(key, UID); // outer_qrcodes_1am

      models.productsModel.hasOne(models.customerCareModel, {
        foreignKey: 'id',
        sourceKey: 'marketed_by'
      })

      //Find in trusted qrcode table
      let codeDetail;
      codeDetail = await CustomModel.findOne({
        where: {
          unique_code: req.query.unique_code,
          // is_active: true
        },
        include: [
          {
            model: models.productsModel,
            as: 'product',
            raw: true,
            include: [{
              model: models.customerCareModel,
              as: 'customer_care',
              raw: true
            }]
          },

          {
            model: models.ProductBatchModel,
            as: 'product_batch',
            raw: true,
          },
          {
            model: models.ProductBatchModel,
            as: 'assigned_batch',
            raw: true,
          },

        ],
        nest: true,
        raw: true
      })
      if (!codeDetail) {
        return res.status(200).send({ success: '0', message: 'Invalid Code' })
      }
      let Object = {};

      // let isAlreadyPurchase = false;
      // let customerId = req.userId; // find

      // Object.trustedQrcodes_id = codeDetail.id;

      let locationDetails;
      if (codeDetail.product_batch.location_id != null) {
        locationDetails = await models.locationModel.findOne({ where: { id: codeDetail.product_batch.location_id }, raw: true })
        console.log("location details found >>>>>>", locationDetails);
      }



      // Move this function to a new API For gettin Child and Parent
      // Object.level = key;
      // switch (key) {
      //   case 'P':
      //     Object.level = "Primary";
      //     break;
      //   case 'S':
      //     Object.level = "Secondary";
      //     break;
      //   case 'T':
      //     Object.level = "Tertiary";
      //     break;
      //   case 'O':
      //     Object.level = "Outer";
      //     break;
      //   default:
      //     return res.status(200).send({ success: '0', message: 'Invalid level for code' });
      // }

      let isGeneral = codeDetail.is_general;
      // let codeLevel = key;
      // let UIDMrp = '-';

      // let caseMRP = !isGeneral ? codeDetail.product_batch.mrp : codeDetail.assigned_batch.mrp;
      // console.log("Case MRP::", caseMRP);

      // if (caseMRP) {
      //   let masterInfo = !isGeneral ? codeDetail.product_batch : codeDetail.assigned_batch
      //   let mrpData = await qrcodeController.getCalculatedMRP(masterInfo, caseMRP);
      //   console.log("---Mrp Calculated", mrpData);

      //   let varName = codeLevel.toLowerCase() + 'MRP';
      //   UIDMrp = mrpData[varName];
      // }

      // if (codeDetail.is_replaced) {
      //   mappingType = 'Replaced';
      //   replacedBy = codeDetail.replaced_with;

      // } else if (codeDetail.transaction_id || codeDetail.mapp_transaction_id) {
      //   if (codeDetail.transaction.is_other || codeDetail.mapping_transaction.is_other) {
      //     mappingType = 'NonQR-QR';
      //   }
      //   else {
      //     mappingType = 'Mapped';
      //   }
      // } else if (codeDetail.is_mapped || codeDetail.is_complete) {
      //   mappingType = 'Mapped';
      // }

      // let parent = [];
      // let childs = [];

      // if (!codeDetail.is_replaced) {
      //   if (codeDetail.is_mapped) {
      //     let masterInfo = !isGeneral ? codeDetail.product_batch : codeDetail.assigned_batch;
      //     let ParentLvl = await parentLvl(codeLevel, masterInfo);
      //     // let ParentLvl = codeDetail.parent_level;
      //     if (ParentLvl != null) {
      //       let ParentModel = await getDynamicModel(ParentLvl, !isGeneral ? codeDetail.product.u_id : codeDetail.assigned_product.u_id);
      //       if (!ParentModel) {
      //         console.log('Dynamic Parent Model Not Found');
      //         // return res.status(200).send({ success: 0, message: 'Dynamic Parent Model Not Found' })
      //       }
      //       else {
      //         let parentCode = await ParentModel.findOne({
      //           where: {
      //             id: codeDetail.mapped_to_parent
      //           },
      //           raw: true
      //         })
      //         if (!parentCode) {
      //           return res.status(200).send({ success: 0, message: 'Parent Code Not Found' })
      //         }
      //         parent.push({ unique_code: parentCode.unique_code, qr_code: parentCode.qr_code })
      //       }
      //     }

      //   }

      //   if (codeDetail.is_complete || true) {
      //     let innerLevel;
      //     // let currentProductInfo = !isGeneral ? codeDetail.product : codeDetail.assigned_product;
      //     let masterInfo = !isGeneral ? codeDetail.product_batch : codeDetail.assigned_batch;
      //     // console.log(">>>>>>>>>>>>>>>>masterInfo", masterInfo);
      //     if (codeLevel == 'S') {
      //       if (masterInfo.is_mapp_primary) {
      //         innerLevel = 'P';
      //       }
      //     }
      //     else if (codeLevel == 'T') {
      //       if (masterInfo.is_mapp_secondary) {
      //         innerLevel = 'S';
      //       }
      //       else if (masterInfo.is_mapp_primary) {
      //         innerLevel = 'P'
      //       }
      //     }
      //     else if (codeLevel == 'O') {
      //       if (masterInfo.is_mapp_tertiary) {
      //         innerLevel = 'T';
      //       } else if (masterInfo.is_mapp_secondary) {
      //         innerLevel = 'S';
      //       } else if (masterInfo.is_mapp_primary) {
      //         innerLevel = 'P';
      //       }
      //     }

      //     if (innerLevel) {
      //       let ChildModel, GeneralChildModel;
      //       GeneralChildModel = await getDynamicModel(innerLevel, codeDetail.product.u_id);
      //       console.log("--------------------GeneralChildModel Found----------------", GeneralChildModel);

      //       if (!isGeneral) {
      //         ChildModel = await getDynamicModel(innerLevel, codeDetail.product.u_id);
      //         console.log("--------------------General Product Found----------------", ChildModel);
      //       }
      //       else {   // General code
      //         ChildModel = await getDynamicModel(innerLevel, codeDetail.assigned_product?.u_id);   // UID of asssigned product
      //       }
      //       if (!ChildModel || !GeneralChildModel) {
      //         return res.status(200).send({ success: 0, message: `Child Model (${!ChildModel ? 'Specific' : 'General'}) Not Found` })
      //       }

      //       // Updating parents of specific children
      //       let childCodes = await ChildModel.findAll({
      //         where: {
      //           is_replaced: false,
      //           mapped_to_parent: codeDetail.id    // Previous Parent 
      //         },
      //         raw: true
      //       })

      //       // // Updating parents of general children
      //       let generalChildCodes = await GeneralChildModel.findAll({
      //         where: {
      //           is_replaced: false,
      //           mapped_to_parent: codeDetail.id    // Previous Parent 
      //         },
      //         raw: true
      //       })

      //       let allChilds = [...childCodes, ...generalChildCodes];

      //       allChilds.forEach(element => {
      //         childs.push({ unique_code: element.unique_code, qr_code: element.qr_code })
      //       });
      //     }
      //     else {
      //       console.log("----------Inner Level Not Found------------");
      //     }
      //   }
      // }

      let mfgDate = !isGeneral ? codeDetail.product_batch.mfg_date : codeDetail.assigned_batch.mfg_date
      if (mfgDate) {
        mfgDate = moment(new Date(mfgDate)).format('DD/MMM/YYYY').toUpperCase();
      }

      let expDate = !isGeneral ? codeDetail.product_batch.exp_date : codeDetail.assigned_batch.exp_date
      if (expDate) {
        expDate = moment(new Date(expDate)).format('DD/MMM/YYYY').toUpperCase();
      }

      // let data = [
      //   `Code Type : ${isGeneral ? 'General' : codeDetail.is_open ? 'Open' : 'Specific'}`,
      //   `PO Details : ${!isGeneral && !codeDetail.is_open ? codeDetail.production_order.po_number : ''}`,
      //   `Item Code : ${!isGeneral ? codeDetail.product.sku : codeDetail.assigned_product.sku}`,
      //   `Item Name : ${!isGeneral ? codeDetail.product.name : codeDetail.assigned_product.name}`,
      //   `Batch No : ${!isGeneral ? codeDetail.product_batch.batch_no : codeDetail.assigned_batch.batch_no}`,
      //   `Mfg. Date : ${mfgDate}`,
      //   `Exp. Date : ${expDate}`,
      //   `MRP of UID : ${UIDMrp}`,
      //   `Date Of Generation : ${moment(new Date(codeDetail.createdAt)).format('DD/MMM/YYYY').toUpperCase()}`,
      //   `Mapping Type : ${mappingType}`,
      //   `Replaced By : ${replacedBy}`,
      //   `Replaced From : ${codeDetail.replaced_from ? codeDetail.replaced_from : ''}`,
      // ]
      // let lvlName = {
      //   'O': "Outer",
      //   'T': "Tertiary",
      //   'S': "Secondary",
      //   'P': "Primary"
      // }
      // let obj = {
      //   level: lvlName[level],
      //   code: codeDetail,
      //   locationDetails: locationDetails,
      //   details: data,
      //   parent: parent,
      //   child: childs
      // }
      // Object.obj = obj;


      Object = { ...Object, ...codeDetail }

      let purchasedByOther = false;
      let rewardsClaimed = false;
      let claimedByOther = false;
      let isAlreadyPurchase = false;

      let currDate = new Date();
      let currMonth = currDate.getMonth();
      console.log("curr month >>>> ", currMonth);
      currMonth = currMonth > 9 ? currMonth : `0${currMonth}`; // MM formate
      const currYear = currDate.getFullYear().toString().substr(-2); // YY formate
      let UIDCustomModel = `${currMonth}_${currYear}`;
      let dynamicCustomerProduct = await DynamicModels.getCustomerProductsModel(UIDCustomModel);

      console.log("customModel >>>>>>>>", dynamicCustomerProduct);
      //  if (level == 'P') {
      //    dynamicCustomerProduct = 'customer_product_' + level.toLowerCase();
      // } else if (level == 'S') {
      //   dynamicCustomerProduct = 'customer_product_' + level.toLowerCase();
      // } else if (level == 'T') {
      //   dynamicCustomerProduct = 'customer_product_' + level.toLowerCase();
      // } else if (level == 'O') {
      //   dynamicCustomerProduct = 'customer_product_' + level.toLowerCase();
      // }
      console.log(dynamicCustomerProduct, 'my data>>>>>>>>>>>>>>>');
      let customer_product = await dynamicCustomerProduct.findOne({
        where: {
          // code_id: codeDetail.id,
          // [Op.or]: [{ code: codeDetail.qr_code }, { code: codeDetail.tft_trusted_qrcode }],
          unique_code: req.query.unique_code,
          // status: true,
          customer_id: req.consumerId
        }
      })
      if (customer_product) {

        if (customer_product.customer_id != req.consumerId) {
          purchasedByOther = true
        }

        customer_id = customer_product.customer_id;

        isAlreadyPurchase = true;

        // let authentication_details = await ProductAuthentication.findOne({
        //   where: {
        //     // code_id: codeDetail.id,
        //     code: req.query.unique_code,
        //     customer_id: req.consumerId   //Anticounterfeiting
        //   },
        //   raw: true
        // })

        // console.log("Authentication details", authentication_details);

        // if (customer_product) {
        //   already_authenticated = true;
        //   if (customer_product.customer_id != req.consumerId) {
        //     authenticated_by_other = true;
        //   }
        // }

        // let claim_details = await ProductReward.findOne({
        //   where: {
        //     consumer_type: roleId,
        //     code: codeDetail.unique_code,
        //     // [Op.or]: [{ code: codeDetail.qr_code }, { code: codeDetail.tft_trusted_qrcode }],
        //     customer_id: req.consumerId   //Anticounterfeiting
        //   }
        // });
      }





      console.log(">>>>>>>>>>>>>Object", Object);

      return res.status(200).send({
        success: 1,
        data: Object,
        // is_already_purchase: isAlreadyPurchase,
        // purchasedByOther: purchasedByOther,
        // already_authenticated: already_authenticated,
        // authenticated_by_other: authenticated_by_other,
        // rewards_claimed: rewards_claimed,
        // claimed_by_other: claimed_by_other,
        // ratings: ratings,
        //comments: comments,

      })

    } catch (ex) {
      console.log(ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }

  },

  getUserocationInfo: async (req, res) => {
    try {

      let validator = new v(req.query, {
        latitude: "required",
        longitude: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let locationDetails = await LocationTracker.trackLocation(req.body.latitude, req.body.longitude);

      if (locationDetails.status) {
        data.latitude = locationDetails.data.storeLat;
        data.longitude = locationDetails.data.storeLng;
      }
      console.log("location info>>>>", locationDetails);
    } catch (error) {
      logger.error(req, error.message);
      console.log("messs", error)
      return res.status(500).send({
        'success': '0',
        'message': error.message
      });
    }
  },
}


async function rewardExist(roleId, consumerId, batchId, productId, level, zrtInfo) {
  let consumerDetails;
  // find user info 
  if (roleId == 0) {
    // check in consumer table
    consumerDetails = await ConsumerModel.findOne({
      where: {
        id: consumerId
      },
      raw: true,
      attributes: ["id", "city_id"]
    })

  } else if (roleId > 0) {
    // check in cp table
    consumerDetails = await ChannelPartners.findOne({
      where: {
        id: consumerId
      },
      raw: true,
      attributes: ["id", "city_id"]
    })
  } else {
    // not logged in 
  }

  let cityDetail = await models.cityModel.findOne({ where: { id: consumerDetails.city_id }, raw: true });

  let regionIds = [];
  let zoneChildHistoryDetails = await models.zoneChildMasterModel.findAll({
    where: {
      cities: { [Op.contains]: [cityDetail.district_id] },
    },
    attributes: ['zone_history_id'],
    order: [["createdAt", "DESC"]],
    raw: true
  })

  if (zoneChildHistoryDetails.length > 0) {
    regionIds = zoneChildHistoryDetails.map(x => x.zone_history_id);
    // return res.status(200).send({ success: 0, message: "Better Luck Next Time!" })
  }

  //get territory Details history idcmd
  let territoryIds = [];
  let territoryHistoryDetails = await models.territoryHistoryMasterModel.findAll({
    where: {
      villages: { [Op.contains]: [cityDetail.id] },
    },
    attributes: ['id'],
    order: [["createdAt", "DESC"]],
    raw: true
  })

  if (territoryHistoryDetails.length > 0) {
    territoryIds = territoryHistoryDetails.map(x => x.id);
    // return res.status(200).send({ success: 0, message: "Please Update Your City To Get Rewards!" })
  }

  //get zone Details history id
  let zoneIds = [];
  let zoneHistoryDetails = await models.parentZoneHistoryMasterModels.findAll({
    where: {
      states: { [Op.contains]: [cityDetail.state_id] },
    },
    attributes: ['id'],
    order: [["createdAt", "DESC"]],
    raw: true
  })

  if (zoneHistoryDetails.length > 0) {
    zoneIds = zoneHistoryDetails.map(x => x.id);
    // return res.status(200).send({ success: 0, message: "Please Update Your City To Get Rewards!" })
  }

  let batchDetails = await models.ProductBatchModel.findOne({ where: { id: batchId }, raw: true });
  if (!batchDetails) {
    return res.status(200).send({ success: 0, message: "Product Batch Not Found" });
  }

  let stateId = [];
  // stateId.push(zoneChildHistoryDetails.state_id);

  // let level = registeredInfo.level;
  level = level == 'P' ? 1 : level == 'S' ? 2 : level == 3 ? 'T' : 4

  let whereClause = {
    [Op.and]: [
      { consumer_type: roleId },
      { lvl_type: { [Op.contains]: [level] } },
      {
        [Op.or]: [
          { regions: { [Op.overlap]: regionIds } },
          { territories: { [Op.overlap]: territoryIds } },
          { zones: { [Op.overlap]: zoneIds } },
        ]
      },
      {
        [Op.or]: [
          {
            type: 2  /// infinite
          },
          {
            type: 1,
            start_date: {
              [Op.lte]: new Date()  // Eligible For Reward On The Basis Product Registration (right now current date)
            },
            end_date: {
              [Op.gte]: new Date()
            }
          }
        ]
      },
      { sku_id: { [Op.contains]: [productId] } },
      { product_batch: { [Op.contains]: [batchId] } },
      { is_deleted: false }
    ]
    // states: { [Op.contains]: stateId },
  }
  let pointAllocate = await PointAllocation.findOne({
    where: whereClause,
    order: [['createdAt', 'DESC']],
    raw: true
  });

  let isOutSideScan = false;
  if (zoneIds.includes(zrtInfo.zone_id) && regionIds.includes(zrtInfo.region_id) && territoryIds.includes(zrtInfo.territory_id)) {
    console.log("inside planned zone scanning");
    isOutSideScan = false;
  }
  else {
    console.log("outside user Scan");
    isOutSideScan = true;
  }

  let schemeExists = false;

  if (pointAllocate) {
    console.log("return1")
    schemeExists = true;
    return { isOutSideScan, schemeExists };
  }

  let luckyDrawDetail = await LuckyDraws.findOne({
    where: {
      [Op.and]: [
        { status: 1 },
        { lvl_type: { [Op.contains]: [level] } },
        { skus: { [Op.contains]: [productId] } },
        { product_batch: { [Op.contains]: [batchId] } },
        {
          [Op.or]: [
            { regions: { [Op.overlap]: regionIds } },
            { territories: { [Op.overlap]: territoryIds } },
            { zones: { [Op.overlap]: zoneIds } },
          ]
        },
        {
          start_date: { [Op.lte]: new Date() }
        },
        {
          end_date: {
            [Op.gte]: new Date()
          }
        }
      ]

    }
  });
  if (luckyDrawDetail) {
    console.log("return2")
    schemeExists = true
    return { isOutSideScan, schemeExists };
    // return true;
  }

  console.log("return3")
  return { isOutSideScan, schemeExists };
  schemeExists = true
  // return false;
}

async function rewardExistOnBatch(batchId, productId, level) {
  let batchDetails = await models.ProductBatchModel.findOne({ where: { id: batchId }, raw: true });
  if (!batchDetails) {
    return res.status(200).send({ success: 0, message: "Product Batch Not Found" });
  }

  level = level == 'P' ? 1 : level == 'S' ? 2 : level == 3 ? 'T' : 4

  let whereClause = {
    [Op.and]: [
      // { consumer_type: roleId },
      { lvl_type: { [Op.contains]: [level] } },
      // {
      //   [Op.or]: [
      //     { regions: { [Op.overlap]: regionIds } },
      //     { territories: { [Op.overlap]: territoryIds } },
      //     { zones: { [Op.overlap]: zoneIds } },
      //   ]
      // },
      {
        [Op.or]: [
          {
            type: 2  /// infinite
          },
          {
            type: 1,
            start_date: {
              [Op.lte]: new Date()  // Eligible For Reward On The Basis Product Registration (right now current date)
            },
            end_date: {
              [Op.gte]: new Date()
            }
          }
        ]
      },
      { sku_id: { [Op.contains]: [productId] } },
      { product_batch: { [Op.contains]: [batchId] } },
      { is_deleted: false }
    ]
    // states: { [Op.contains]: stateId },
  }
  let pointAllocate = await PointAllocation.findOne({
    where: whereClause,
    order: [['createdAt', 'DESC']],
    raw: true
  });

  let schemeExists = false;

  if (pointAllocate) {
    console.log("return1")
    schemeExists = true;
    return { schemeExists };
  }

  let luckyDrawDetail = await LuckyDraws.findOne({
    where: {
      [Op.and]: [
        { status: 1 },
        { lvl_type: { [Op.contains]: [level] } },
        { skus: { [Op.contains]: [productId] } },
        { product_batch: { [Op.contains]: [batchId] } },
        // {
        //   [Op.or]: [
        //     { regions: { [Op.overlap]: regionIds } },
        //     { territories: { [Op.overlap]: territoryIds } },
        //     { zones: { [Op.overlap]: zoneIds } },
        //   ]
        // },
        {
          start_date: { [Op.lte]: new Date() }
        },
        {
          end_date: {
            [Op.gte]: new Date()
          }
        }
      ]

    }
  });
  if (luckyDrawDetail) {
    console.log("return2")
    schemeExists = true
    return { schemeExists };
  }

  console.log("return3")
  return { schemeExists };
}


function AddMinutesToDate(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

async function antiCounterfit(roleId, consumerId, zrtInfo) {
  // check
  let consumerDetails;
  // find user info 
  if (roleId == 0) {
    // check in consumer table
    consumerDetails = await ConsumerModel.findOne({
      where: {
        id: consumerId
      },
      raw: true,
      attributes: ["id", "city_id"]
    })

  } else if (roleId > 0) {
    // check in cp table
    consumerDetails = await ChannelPartners.findOne({
      where: {
        id: consumerId
      },
      raw: true,
      attributes: ["id", "city_id"]
    })
  } else {
    // not logged in 
  }

  let cityDetail = await models.cityModel.findOne({ where: { id: consumerDetails.city_id }, raw: true });

  let regionIds = [];
  let zoneChildHistoryDetails = await models.zoneChildMasterModel.findAll({
    where: {
      cities: { [Op.contains]: [cityDetail.district_id] },
    },
    attributes: ['zone_history_id'],
    order: [["createdAt", "DESC"]],
    raw: true
  })

  if (zoneChildHistoryDetails.length > 0) {
    regionIds = zoneChildHistoryDetails.map(x => x.zone_history_id);
    // return res.status(200).send({ success: 0, message: "Better Luck Next Time!" })
  }

  //get territory Details history idcmd
  let territoryIds = [];
  let territoryHistoryDetails = await models.territoryHistoryMasterModel.findAll({
    where: {
      villages: { [Op.contains]: [cityDetail.id] },
    },
    attributes: ['id'],
    order: [["createdAt", "DESC"]],
    raw: true
  })

  if (territoryHistoryDetails.length > 0) {
    territoryIds = territoryHistoryDetails.map(x => x.id);
    // return res.status(200).send({ success: 0, message: "Please Update Your City To Get Rewards!" })
  }

  //get zone Details history id
  let zoneIds = [];
  let zoneHistoryDetails = await models.parentZoneHistoryMasterModels.findAll({
    where: {
      states: { [Op.contains]: [cityDetail.state_id] },
    },
    attributes: ['id'],
    order: [["createdAt", "DESC"]],
    raw: true
  })

  if (zoneHistoryDetails.length > 0) {
    zoneIds = zoneHistoryDetails.map(x => x.id);
    // return res.status(200).send({ success: 0, message: "Please Update Your City To Get Rewards!" })
  }


  // let outSideScanning = false;
  console.log("1zrtInfo>>>>>>>", zrtInfo);
  console.log("zoneIds>>>>>>", zoneIds);
  console.log("regionIds>>>>>>", regionIds);
  console.log("territoryIds>>>>", territoryIds)


  if (zoneIds.includes(zrtInfo.zone_id) && regionIds.includes(zrtInfo.region_id) && territoryIds.includes(zrtInfo.territory_id)) {
    console.log("inside planned zone scanning");
    return false;
  }
  else {
    console.log("outside user Scan");
    return true;
  }
  // return outSideScanning;
}

async function getDynamicModel(key, UID) {
  try {
    console.log("-------key", key);
    console.log(">>>>>u>", UID);
    let CustomModel;
    switch (key) {
      case 'P':
        CustomModel = await DynamicModels.getPrimaryQRCodesModel(UID.toLowerCase());
        break;
      case 'S':
        CustomModel = await DynamicModels.getSecondaryQRCodesModel(UID.toLowerCase());
        break;
      case 'T':
        CustomModel = await DynamicModels.getTertiaryQRCodesModel(UID.toLowerCase());
        break;
      case 'O':
        CustomModel = await DynamicModels.getOuterQRCodesModel(UID.toLowerCase());
        break;
      default:
        console.log("---Invalid Level----", new Date());
        break;
    }
    return CustomModel;
  } catch (error) {
    console.log(error);
  }
}

async function getUIDAndLevel(code) {
  let UID, level;
  let dynamicCode = code[2] + code[6] + code[8];
  let dynamicUID = await DynamicUIDModel.findOne({
    where: {
      code: dynamicCode
    },
    raw: true
  })

  if (!dynamicUID) {
    console.log("-------------Dynamic UID Not Found");
  } else {
    UID = dynamicUID.u_id
  }

  let dynamicLevel = await DynamicLevelCodesModel.findOne({
    where: {
      code: code[4],
      level: {
        [Op.ne]: null
      }
    },
    raw: true
  })
  console.log("dyanmic Level::", code[4], dynamicLevel);
  if (!dynamicLevel) {
    console.log("-------------,Level Not Found");
  } else {
    level = dynamicLevel.level
  }
  console.log(">>>>>>>>?data?????>", level, "?????", UID);

  return {
    UID: UID,
    level: level
  }
}

function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive
}

function uniteCalulation(unite, value) {
  let unitesFactor = {
    'Gms': (1 / 1000),
    'Gm': (1 / 1000),
    'Ml': (1 / 1000),
    'Nos': 1,
    'Ltr': 1,
    'Kg': 1
  };
  return Number(value) * unitesFactor[unite];
}

function codePrimarySize(batchDetails, count, level) {
  let totalCount
  if (level == 4) {
    totalCount = Number(count) *
      (batchDetails.outer_size != null ? Number(batchDetails.outer_size) : 1) *
      (batchDetails.tertiary_size != null ? batchDetails.tertiary_size : 1) *
      (batchDetails.secondary_size != null ? batchDetails.secondary_size : 1);
  } else if (level == 3) {
    totalCount = Number(count) *
      (batchDetails.outer_size != null ? Number(batchDetails.outer_size) : 1) *
      (batchDetails.tertiary_size != null ? batchDetails.tertiary_size : 1);
  } else if (level == 2) {
    totalCount = Number(count) *
      (batchDetails.outer_size != null ? Number(batchDetails.outer_size) : 1);
  } else {
    totalCount = Number(count);
  }
  return totalCount;
}

async function schemeWisePointAllocation(type, level, batchDetails, pointAllocate, CustomerProductModel, ScratchCardModel, req) {
  let extraPoints = 0;
  let milestone = null;
  let scannedCount = await CustomerProductModel.findAll({
    where: {
      scheme_id: { [Op.contains]: [pointAllocate.id] },
      role_id: req.roleId,
      customer_id: req.consumerId,
      level: { [Op.in]: ['P', 'S', 'T', 'O'] }
    }
  });

  let Volumes = {
    'PVolume': 0,
    'SVolume': 0,
    'TVolume': 0,
    'OVolume': 0
  };

  let levels = {
    '1': 'P',
    '2': 'S',
    '3': 'T',
    '4': 'O'
  }
  let previousCount = 0;
  for (let i = 1; i <= 4; i++) {
    if (type == 1) {
      if (level == i) {
        Volumes[`${levels[`${i}`]}Volume`] = scannedCount.filter(x => x.level == levels[`${i}`]).length;
      }
    } else {
      Volumes[`${levels[`${i}`]}Volume`] = codePrimarySize(batchDetails, scannedCount.filter(x => x.level == levels[`${i}`]).length, level);

    }
    previousCount += Volumes[`${levels[`${i}`]}Volume`];
  }
  let factorType = {
    '1': 1,
    '2': uniteCalulation(batchDetails.standard_unit, batchDetails.size),
    '3': 1,
    '4': 1
  }
  //
  let factor = factorType[`${type}`];
  let totalVolume = 0;
  if (type == 1) {
    totalVolume = factor * (previousCount + 1);
  } else {
    totalVolume = factor * (previousCount + codePrimarySize(batchDetails, 1, level));
  }
  //
  let schemePoints = pointAllocate.scheme_points;
  let minScannedList = schemePoints.map(x => x.min_scanned);
  let oldScratchCard = await ScratchCardModel.findAll({
    where: {
      customer_id: req.consumerId,
      card_type: 1,
      scheme_id: pointAllocate.id,
      scheme_id_milestone: { [Op.in]: minScannedList }
    },
    order: [["scheme_id_milestone", "DESC"]],
    raw: true
  });
  if (oldScratchCard.length > 0) {
    schemePoints = schemePoints.filter(x => !((oldScratchCard.map(y => Number(y.scheme_id_milestone))).includes(x.min_scanned)) && x.min_scanned > oldScratchCard[0].scheme_id_milestone);
  }
  let pointIndex = 0;
  if (schemePoints.length > 0) {
    // var maxPoint = schemePoints.reduce(function (i, j) { return { min_scanned: j.min_scanned <= totalVolume ? Math.max(i.min_scanned, j.min_scanned) : i.min_scanned, extra_points: j.extra_points } }, { min_scanned: 0 });
    var maxPoint = { min_scanned: 0, extra_points: 0 };
    for (let index = 0; index < schemePoints.length; index++) {
      const element = schemePoints[index];
      if (element.min_scanned <= totalVolume || true) {
        maxPoint.min_scanned = element.min_scanned;
        maxPoint.extra_points = element.extra_points;
        break;
      }
    }

    if ([4].includes(type)) {
      if ((totalVolume % maxPoint.min_scanned == 0) && maxPoint.min_scanned != 0) {
        milestone = maxPoint.min_scanned;
        extraPoints = Number(Match.ceil(maxPoint.extra_points));
        // extraPoints = codePrimarySize(batchDetails, Number(maxPoint.extra_points), level);
      }
    }
    else {
      if (maxPoint.min_scanned <= totalVolume && maxPoint.min_scanned != 0) {
        milestone = maxPoint.min_scanned;
        extraPoints = Number(maxPoint.extra_points);
        // extraPoints = codePrimarySize(batchDetails, Number(maxPoint.extra_points), level);
      }
    }
  }
  return { milestone, extraPoints }
}

async function parentLvl(codeLevel, masterInfo) {
  let outerLevel = null;
  if (codeLevel == 'P') {
    if (masterInfo.is_mapp_secondary) {
      outerLevel = 'S';
    }
    else if (masterInfo.is_mapp_tertiary) {
      outerLevel = 'T';
    }
    else {
      outerLevel = 'O';
    }
  }
  else if (codeLevel == 'S') {
    if (masterInfo.is_mapp_tertiary) {
      outerLevel = 'T';
    }
    else {
      outerLevel = 'O';
    }
  }
  else if (codeLevel == 'T') {
    outerLevel = 'O';
  }
  else if (codeLevel == 'O') {
    outerLevel = null;
  }
  return outerLevel;
};

async function generateQrCodeString(uniqueCode, level, batchNo, mfgDate, expDate, sku, pIsGeneral) {
  //----Generate QR code string

  // req.query.unique_code = 'https://wcpl.trusttags.in/01/810000893/10/WL24ITB041/21/LELPUMV2JMCEA?11=240330&17=260329';
  // req.query.unique_code = 'https://wcpl.trusttags.in/01/[GTIN/SKU]/10/[Batch_no]/21/[Unique_code]?11=[mfg]&17=[exp]';
  // req.query.unique_code =  'https://wcpl.trusttags.in/01/GENERAL_ITEM/10/GENERAL_BATCH/21/7G3NXVM4PLCC4?11=&17='
  // URL General code
  //  1  >> url : HTTPS://TTAGS.COM/SAM/?V:2~P:3~UID:JYM59H3UF4JA8~BAT:BATCH3~MFG:01JUL23~EXP:11OCT28~ITEM:KBSA >>DT :- DDMMMYY
  //  2  >> url : https://ttags.in/01/1234566789451/10/BATCH3/21/SHC8HTMSXPKAA?11=230701&17=281011 >>DT :- YYMMDD


  let qrCode = ''
  qrCode = `${models.config.codeUrl.toLowerCase()}/01/${sku}/10/${batchNo}/21/${uniqueCode}?11=${mfgDate}&17=${expDate}`
  if (pIsGeneral) {
    // general code string
    qrCode = `${models.config.codeUrl.toLowerCase()}/01/GENERAL_ITEM/10/GENERAL_BATCH/21/${uniqueCode}?11=&17=`
  }
  return qrCode;
}

module.exports = consumerController;