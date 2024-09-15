const v = require("node-input-validator");
const logger = require("../../helpers/logger");
const uuid = require('uuid');
const moment = require('moment');
const consumerModel = require("../../models").consumers;
const DealerFirms = require("../../models").dealer_firms;
const DealerMobiles = require("../../models").dealer_mobileno;
const ChannelPartners = require("../../models").channel_partners;
const products = require("../../models").products;
const city = require("../../models").city;
const state = require("../../models").state;
const ProductView = require('../../models').product_view;
const productReward = require('../../models').product_rewards;
const rewardRedeemHistory = require('../../models').reward_redeem_history
const randomstring = require("randomstring");
const fs = require("fs");
const path = require("path");
const productImageDir = path.join("uploads/product_images/");
const productIconImagesDir = path.join("uploads/product_use/");

const models = require("../_models");
const DynamicModels = require('../../models/dynamic_models');
const Sequelize = require('sequelize');
const e = require("connect-timeout");
const Op = Sequelize.Op;

const parseValidate = require("../../middleware/parseValidate");

consumerModel.hasOne(city, {
  foreignKey: 'id',
  sourceKey: 'city_id'
});
consumerModel.hasOne(state, {
  foreignKey: 'id',
  sourceKey: 'state_id'
});

ChannelPartners.hasOne(city, {
  foreignKey: 'id',
  sourceKey: 'city_id'
});
ChannelPartners.hasOne(state, {
  foreignKey: 'id',
  sourceKey: 'state_id'
});

productReward.hasOne(products, {
  foreignKey: 'id',
  sourceKey: 'product_id'
})

productReward.hasOne(DealerMobiles, {
  foreignKey: 'id',
  sourceKey: 'customer_id'
})

ChannelPartners.hasOne(models.parentZoneHistoryMasterModels, {
  foreignKey: "id",
  sourceKey: "zone_id",
});

ChannelPartners.hasOne(models.zoneHistoryMasterModels, {
  foreignKey: "id",
  sourceKey: "region_id",
});

ChannelPartners.hasOne(models.territoryHistoryMasterModel, {
  foreignKey: "id",
  sourceKey: "territory_id",
});

// ChannelPartners.hasOne(models.districtModel, {
//     foreignKey: 'id',
//     sourceKey: 'district_id'
// });

// ChannelPartners.hasOne(models.taluksModel, {
//     foreignKey: 'id',
//     sourceKey: 'taluks_id'
// });

// consumerModel.hasOne(models.districtModel, {
//     foreignKey: 'id',
//     sourceKey: 'district_id'
// });

// consumerModel.hasOne(models.taluksModel, {
//     foreignKey: 'id',
//     sourceKey: 'taluks_id'
// });

let consumer = {
  getConsumers: async (req, res) => {
    console.log(">>>>>>>>>>>>Get Consumer API Called");
    try {
      let consumerRole = [0];
      if (req.query.for == 'cp') {
        consumerRole = [1, 2, 3]
        let whereClause = {
          role_id: { [Op.in]: consumerRole },
          is_deleted: false,
          //is_verified: true
        };

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

        let channelPartnersList = await ChannelPartners.findAll({
          where: whereClause,
          include: [
            {
              model: city,
              attributes: ["name"]
            }, {
              model: state,
              attributes: ["name"]
            }
          ],
          order: [["createdAt", "DESC"]],
        });
        return res.status(200).send({ success: '1', data: channelPartnersList })

      }

      let whereClause = {
        role_id: { [Op.in]: consumerRole },
        is_deleted: false,
        //is_verified: true
      };
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

      let consumer_list = await consumerModel.findAll({
        where: whereClause,
        include: [
          {
            model: city,
            attributes: ["name"]
          }, {
            model: state,
            attributes: ["name"]
          }
        ]
      });
      return res.status(200).send({ success: '1', data: consumer_list })
    }
    catch (error) {
      console.log("error in ", error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  getConsumerById: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: 'required'
      });

      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors });
      }
      if (req.query.for === 'cp') {

        let channelPartnersDetails = await ChannelPartners.findOne({
          where: {
            id: req.query.id,
            is_deleted: false,
            // is_verified: true
          },
          include: [{
            model: city,
            attributes: ['id', "name", 'district_name', 'district_id', 'taluks_id', 'taluks_name']
          }, {
            model: state,
            attributes: ["name"]
          },
          {
            model: models.parentZoneHistoryMasterModels,
            attributes: ["name", "zone_id"]
          }, {
            model: models.zoneHistoryMasterModels,
            attributes: ["name", "zone_id"]
          }, {
            model: models.territoryHistoryMasterModel,
            attributes: ["name", "territory_id"]
          }
          ], raw: true,
        }
        );

        let secFirms = await DealerFirms.findAll({
          where: {
            dealer_id: req.query.id,
            is_deleted: false
          }
        })
        let secNums = await DealerMobiles.findAll({
          where: {
            dealer_id: req.query.id,
            is_deleted: false
          }
        });
        let data = {
          consumer_details: channelPartnersDetails,
          secondary_firms: secFirms,
          secondary_numbers: secNums
        }
        console.log("data>>>>>>>>>>", data);
        return res.status(200).send({ success: '1', data: data })
      }

      let consumerDetail = await consumerModel.findOne({
        where: {
          id: req.query.id,
          is_deleted: false,
          // is_verified: true
        },
        include: [{
          model: city,
          attributes: ['id', "name", 'district_name', 'district_id', 'taluks_id', 'taluks_name']
        }, {
          model: state,
          attributes: ["name"]
        }], raw: true,
      });
      let secFirms = await DealerFirms.findAll({
        where: {
          dealer_id: req.query.id,
          is_deleted: false
        }
      })
      let secNums = await DealerMobiles.findAll({
        where: {
          dealer_id: req.query.id,
          is_deleted: false
        }
      });
      let data = {
        consumer_details: consumerDetail,
        secondary_firms: secFirms,
        secondary_numbers: secNums
      }
      console.log("data>>>>>>>>>>", data);
      return res.status(200).send({ success: '1', data: data })
    }
    catch (error) {
      console.log("error in ", error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  bulkChannelPartnerAdd: async function (req, res) {
    try {
      let validator = new v(req.body, {
        channelParters: "required",
      });
      // req.body.remark = "";
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors)
        return res
          .status(200)
          .send({ success: "0", message: validatorError });
      }

      let rejectedArray = [];

      let allChannelPartners = JSON.parse(req.body.channelParters);
      let headerName = {
        "channelPartnerName": "name",
        "dateOfBirth": "dob",
        "phoneNumber": "phone",
        "firmName": "firmName",
        "establishmentDate": "estDate",
        "address": "address",
        "stateName": "stateName",
        "cityName": "cityName",
        // "pinCode" : "pinCode",
        "channePartnerType": "channePartnerType",
        "zoneUniqueName": "zoneUniqueName",
        "regionUniqueName": "regionUniqueName",
        "territoryUniqueName": "territoryUniqueName"
      };

      for (let [index, element] of allChannelPartners.entries()) {
        console.log("channel partner", element);

        let ele = {};
        let keys = Object.keys(element);
        for (let key of keys) {
          ele[headerName[key]] = element[key] != null ? element[key].toString() : "";
        }

        // console.log("type of>>>>>",typeof(ele.phone))
        if (!isValidMobileNumber(ele.phone)) {
          element.reason = "Invaild Phone no";
          rejectedArray.push(element);
          continue;
        }
        let cpDetails = await models.ChannelPartners.findOne({ where: { phone: ele.phone }, raw: true });

        let consumerDetails = await models.ConsumersModel.findOne({ where: { phone: ele.phone }, raw: true });

        if (!cpDetails && (!consumerDetails)) {

          let cityTitle = ele.cityName;
          // cityTitle = cityTitle.charAt(0).toUpperCase() + cityTitle.slice(1).toLowerCase();

          let stateTitle = ele.stateName;
          // stateTitle = stateTitle.charAt(0).toUpperCase() + stateTitle.slice(1).toLowerCase();

          console.log("state>>>>", stateTitle);
          console.log("city>>>>", cityTitle)
          let userAddressInfo = await models.cityModel.findOne({ where: { state_code: stateTitle, name: cityTitle }, raw: true });
          // let userPinCode = models.pincodeModel.findOne({ where: { pincode: el.pinCode}, raw: true });

          if (!isValidDateFormat(ele.dob)) {
            element.reason = "Invaild Date formate for DOB";
            rejectedArray.push(element);
            continue;
          }

          if (!isValidDateFormat(ele.estDate)) {
            element.reason = "Invaild Date formate for estDate";
            rejectedArray.push(element);
            continue;
          }

          if (userAddressInfo) {
            let roleId;
            // Dealer,Retailer
            if (ele.channePartnerType.toLowerCase() == 'dealer') {
              roleId = 1;
            } else if (ele.channePartnerType.toLowerCase() == 'retailer') {
              roleId = 3;
            }
            else {
              element.reason = "Invaild Channel Partner Type";
              rejectedArray.push(element);
              continue;
            }

            let zone = await models.parentZoneMasterModel.findOne({ where: { unique_id: ele.zoneUniqueName }, raw: true });

            if (zone) {
              let region = await models.zoneMasterModel.findOne({ where: { unique_id: ele.regionUniqueName }, raw: true });

              if (region) {

                let territory = await models.territoryMasterModel.findOne({ where: { unique_id: ele.territoryUniqueName }, raw: true });
                if (territory) {
                  let dob = ele.dob.split('/');
                  dob = dob[1] + "/" + dob[0] + "/" + dob[2];

                  let estDate = ele.estDate.split('/');
                  estDate = estDate[1] + "/" + estDate[0] + "/" + estDate[2];
                  let pincodeDetail = await models.pincodeModel.findOne({ where: { city_id: userAddressInfo.id } });



                  await models.ChannelPartners.create({
                    id: uuid(),
                    name: ele.name,
                    dob: new Date(dob),
                    est_date: new Date(estDate),
                    country_code: "+91",
                    phone: ele.phone,
                    firm_name: ele.firmName,
                    address: ele.address,
                    state_id: userAddressInfo.state_id,
                    city_id: userAddressInfo.id,
                    role_id: roleId,
                    zone_id: zone.zone_history_id,
                    region_id: region.zone_history_id,
                    territory_id: territory.terriotory_history_id,
                    pin_code: pincodeDetail ? pincodeDetail.pincode : null,
                  });
                } else {
                  element.reason = "Invaild Territory Unique Name";
                  rejectedArray.push(element);
                }


              } else {
                element.reason = "Invaild Region Unique Name";
                rejectedArray.push(element);
              }

            } else {
              element.reason = "Invaild Zone Unique Name";
              rejectedArray.push(element);
            }

          } else {
            element.reason = "City or State Invaild";
            rejectedArray.push(element);
          }

        } else {
          console.log("cpDetails", cpDetails)
          element.reason = "Already Exist";
          rejectedArray.push(element);
        }


      }


      console.log("rejectedArray", rejectedArray);
      if (rejectedArray.length > 0) {
        if (rejectedArray.length == allChannelPartners.length) {
          return res.status(200).send({ success: "0", message: `All are rejected due to some reasons`, data: rejectedArray });
        } else {
          return res.status(200).send({ success: "0", message: `${allChannelPartners.length - rejectedArray.length} ${allChannelPartners.length - rejectedArray.length > 1 ? 'Channel Partners are' : 'Channel Partner is'}  added and ${rejectedArray.length} rejected due to some error.`, data: rejectedArray });
        }
      } else {
        return res.status(200).send({ success: "1", message: "Channel Partners are added successfully" });
      }
    }
    catch (error) {
      console.log("error", error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: "Internal Server Error" });
    }
  },
  bulkFarmerAdd: async function (req, res) {
    try {
      let validator = new v(req.body, {
        channelParters: "required",
      });
      // req.body.remark = "";
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors)
        return res
          .status(200)
          .send({ success: "0", message: validatorError });
      }

      let rejectedArray = [];

      let allChannelPartners = JSON.parse(req.body.channelParters);
      let headerName = {
        "farmerName": "name",
        "dateOfBirth": "dob",
        "phoneNumber": "phone",
        "firmName": "firmName",
        "address": "address",
        "stateName": "stateName",
        "cityName": "cityName",
        // "pinCode" : "pinCode",
        "consumerType": "channePartnerType",
      };

      for (let [index, element] of allChannelPartners.entries()) {
        console.log("channel partner", element);

        let ele = {};
        let keys = Object.keys(element);
        for (let key of keys) {
          ele[headerName[key]] = element[key] != null ? element[key].toString() : "";
        }

        // console.log("type of>>>>>",typeof(ele.phone))
        if (!isValidMobileNumber(ele.phone)) {
          element.reason = "Invaild Phone no";
          rejectedArray.push(element);
          continue;
        }
        let cpDetails = await models.ChannelPartners.findOne({ where: { phone: ele.phone }, raw: true });

        let consumerDetails = await models.ConsumersModel.findOne({ where: { phone: ele.phone }, raw: true });

        if (!cpDetails && (!consumerDetails)) {

          let cityTitle = ele.cityName;
          // cityTitle = cityTitle.charAt(0).toUpperCase() + cityTitle.slice(1).toLowerCase();

          let stateTitle = ele.stateName;
          // stateTitle = stateTitle.charAt(0).toUpperCase() + stateTitle.slice(1).toLowerCase();

          console.log("state>>>>", stateTitle);
          console.log("city>>>>", cityTitle)
          let userAddressInfo = await models.cityModel.findOne({ where: { state_code: stateTitle, name: cityTitle }, raw: true });
          // let userPinCode = models.pincodeModel.findOne({ where: { pincode: el.pinCode}, raw: true });

          if (!isValidDateFormat(ele.dob)) {
            element.reason = "Invaild Date formate for DOB";
            rejectedArray.push(element);
            continue;
          }

          if (userAddressInfo) {
            let roleId;
            // Dealer,Retailer
            if (ele.channePartnerType.toLowerCase() == 'farmer') {
              roleId = 0;
            }
            else {
              element.reason = "Invaild Channel Partner Type";
              rejectedArray.push(element);
              continue;
            }

            let dob = ele.dob.split('/');
            dob = dob[1] + "/" + dob[0] + "/" + dob[2];


            let pincodeDetail = await models.pincodeModel.findOne({ where: { city_id: userAddressInfo.id } });



            await models.ConsumersModel.create({
              id: uuid(),
              name: ele.name,
              dob: new Date(dob),
              country_code: "+91",
              phone: ele.phone,
              address: ele.address,
              state_id: userAddressInfo.state_id,
              city_id: userAddressInfo.id,
              role_id: roleId,
              pin_code: pincodeDetail ? pincodeDetail.pincode : null,
            });

          } else {
            element.reason = "City or State Invaild";
            rejectedArray.push(element);
          }

        } else {
          console.log("cpDetails", cpDetails)
          element.reason = "Phone Number Already Exist";
          rejectedArray.push(element);
        }


      }


      console.log("rejectedArray", rejectedArray);
      if (rejectedArray.length > 0) {
        if (rejectedArray.length == allChannelPartners.length) {
          return res.status(200).send({ success: "0", message: `All are rejected due to some reasons`, data: rejectedArray });
        } else {
          return res.status(200).send({ success: "0", message: `${allChannelPartners.length - rejectedArray.length} ${allChannelPartners.length - rejectedArray.length > 1 ? 'Channel Partners are' : 'Channel Partner is'}  added and ${rejectedArray.length} rejected due to some error.`, data: rejectedArray });
        }
      } else {
        return res.status(200).send({ success: "1", message: "Channel Partners are added successfully" });
      }
    }
    catch (error) {
      console.log("error", error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: "Internal Server Error" });
    }
  },
  registerConsumer: async (req, res) => {
    try {
      let validator = new v(req.body, {
        type: 'required',
        name: 'required',
        dob: 'required',
        phone: 'required',
        state_id: 'required',
        city_id: 'required',
        address: 'required'
      });

      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors })
      }
      let dob = req.body.dob.split('/');
      dob = dob[1] + "/" + dob[0] + "/" + dob[2];
      let findPriDuplicate = await consumerModel.findOne({
        where: {
          phone: req.body.phone.toString(),
          is_deleted: {
            [Op.ne]: true
          }
        }
      });
      if (findPriDuplicate) {
        return res.status(200).send({ success: '0', message: req.body.phone + ' is Already Registered' })
      }

      let findPriDuplicateChannelPartner = await ChannelPartners.findOne({
        where: {
          phone: req.body.phone.toString(),
          is_deleted: {
            [Op.ne]: true
          }
        }
      });
      if (findPriDuplicateChannelPartner) {
        return res.status(200).send({ success: '0', message: req.body.phone + ' is Already Registered' })
      }

      if (req.body.type > 0) {
        let validate = {
          pri_firm: 'required',
          est_date: 'required',
          // sec_firms:'required',
          // sec_nums:'required'
        };
        if (req.body.isZrtBased == true) {
          validate.zone_id = 'required';
          validate.region_id = 'required';
        }
        validator = new v(req.body, validate);
        matched = await validator.check();
        if (!matched) {
          return res.status(200).send({ success: '0', message: validator.errors })
        }
        let est_date = req.body.est_date.split('/');
        est_date = est_date[1] + "/" + est_date[0] + "/" + est_date[2];

        let phone_no_array = [];
        if (req.body.sec_nums.length > 0) {
          phone_no_array = [...req.body.sec_nums]
        }
        phone_no_array.push(req.body.phone.toString());

        //check already added numbers
        let consumernumbers = await consumerModel.findOne({
          where: {
            phone: { [Op.in]: phone_no_array }
          }
        });
        if (consumernumbers) {
          return res.status(200).send({ success: '0', message: consumernumbers.phone + ' already added' })
        }
        let dealernumbers = await DealerMobiles.findOne({
          where: {
            mobile_no: { [Op.in]: phone_no_array }
          }
        })
        if (dealernumbers) {
          return res.status(200).send({ success: '0', message: dealernumbers.mobile_no + ' already added' });
        }
        let zoneHistoryId;
        let regionHistoryId;
        let territoryHistoryId;
        if (req.body.isZrtBased == true) {
          zoneHistoryId = await models.parentZoneMasterModel.findOne({
            where: {
              id: req.body.zone_id
            }
          });
          regionHistoryId = await models.zoneMasterModel.findOne({
            where: {
              id: req.body.region_id
            }
          });

          territoryHistoryId = await models.territoryMasterModel.findOne({
            where: {
              id: req.body.territory_id
            }
          });
        }
        let pincodeDetail = await models.pincodeModel.findOne({ where: { city_id: req.body.city_id } });

        let new_consumer = await ChannelPartners.create({
          id: uuid(),
          role_id: req.body.type,
          name: req.body.name,
          dob: new Date(dob),
          phone: req.body.phone.toString(),
          country_code: '+91',
          state_id: req.body.state_id,
          city_id: req.body.city_id,
          pin_code: pincodeDetail ? pincodeDetail.pincode : null,
          firm_name: req.body.pri_firm,
          est_date: est_date,
          address: req.body.address,
          is_verified: true,
          zone_id: zoneHistoryId?.zone_history_id ?? null,
          region_id: regionHistoryId?.zone_history_id ?? null,
          territory_id: territoryHistoryId?.terriotory_history_id ?? null
        });

        for (let i = 0; i < req.body.sec_firms.length; i++) {
          await DealerFirms.create({
            id: uuid(),
            dealer_id: new_consumer.id,
            firm_name: req.body.sec_firms[i]
          })
        }
        for (let i = 0; i < req.body.sec_nums.length; i++) {
          await DealerMobiles.create({
            id: uuid(),
            dealer_id: new_consumer.id,
            mobile_no: req.body.sec_nums[i]
          });
        }
        if (new_consumer) {
          return res.status(200).send({ success: '1' })
        } else {
          return res.status(200).send({ success: '0' })
        }
      } else {

        let new_consumer = await consumerModel.create({
          id: uuid(),
          role_id: req.body.type,
          name: req.body.name,
          dob: new Date(dob),
          phone: req.body.phone.toString(),
          country_code: "+91",
          state_id: req.body.state_id,
          city_id: req.body.city_id,
          address: req.body.address,
          // is_verified: true
        });
        if (new_consumer) {
          return res.status(200).send({ success: '1', message: 'created' })
        }
      }
    }
    catch (error) {
      console.log("error in ", error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  editConsumer: async (req, res) => {
    try {
      let validator = new v(req.body, {
        id: 'required',
        type: 'required',
        name: 'required',
        dob: 'required',
        phone: 'required',
        state_id: 'required',
        city_id: 'required',
        address: 'required'
      });

      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors })
      }
      if (req.query.for === 'cp') {
        let validate = {};
        if (req.query.isZrtBased == 'true') {
          validate = {
            zone_id: 'required',
            region_id: 'required',
          };
        }
        validator = new v(req.body, validate);
        matched = await validator.check();
        console.log("check for data>>>>>", req.body)
        if (!matched) {
          return res.status(200).send({ success: '0', message: validator.errors })
        }


        // for channel partner
        let channelPartnersDetails = await ChannelPartners.findOne({
          where: {
            id: req.body.id
          },
          raw: true,
        })
        if (!channelPartnersDetails) {
          return res.status(200).send({ success: '0', message: 'Channel Partner Not Found' })
        }

        // search for history ids
        let zoneHistoryId;
        let regionHistoryId;
        let territoryHistoryId;
        if (req.query.isZrtBased == 'true') {
          zoneHistoryId = await models.parentZoneMasterModel.findOne({
            where: {
              id: req.body.zone_id
            }
          });
          regionHistoryId = await models.zoneMasterModel.findOne({
            where: {
              id: req.body.region_id
            }
          });

          territoryHistoryId = await models.territoryMasterModel.findOne({
            where: {
              id: req.body.territory_id
            }
          });

        }


        let dob = req.body.dob.split('/');
        let estDate = req.body.est_date.split('/');

        dob = dob[1] + "/" + dob[0] + "/" + dob[2];
        estDate = estDate[1] + "/" + estDate[0] + "/" + estDate[2];

        if (channelPartnersDetails.role_id > 0) {
          validator = new v(req.body, {
            pri_firm: "required",
            est_date: "required"
          });
          matched = await validator.check();
          if (!matched) {
            return res.status(200).send({ success: '0', message: validator.errors })
          }
          let pincodeDetail = await models.pincodeModel.findOne({ where: { city_id: req.body.city_id } });

          await ChannelPartners.update({
            name: req.body.name,
            dob: dob,
            phone: req.body.phone,
            state_id: req.body.state_id,
            city_id: req.body.city_id,
            pin_code: pincodeDetail ? pincodeDetail.pincode : null,
            firm_name: req.body.pri_firm,
            est_date: estDate,
            address: req.body.address,
            zone_id: zoneHistoryId?.zone_history_id ?? null,
            region_id: regionHistoryId?.zone_history_id ?? null,
            territory_id: territoryHistoryId?.terriotory_history_id ?? null
          }, {
            where: {
              id: req.body.id
            }
          })
        }
        return res.status(200).send({ success: '1', message: 'Channel Partners updated' })
      }

      // for consumer 
      let consumer_detail = await consumerModel.findOne({
        where: {
          id: req.body.id
        },
        raw: true,
      })
      if (!consumer_detail) {
        return res.status(200).send({ success: '0', message: 'Consumer Not Found' })
      }
      let dob = req.body.dob.split('/');
      dob = dob[1] + "/" + dob[0] + "/" + dob[2];

      await consumerModel.update({
        name: req.body.name,
        dob: dob,
        phone: req.body.phone,
        state_id: req.body.state_id,
        city_id: req.body.city_id,
        address: req.body.address,
      }, {
        where: {
          id: req.body.id
        }
      })

      return res.status(200).send({ success: '1', message: 'Consumer updated' })
    }
    catch (error) {
      console.log("error in ", error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  deleteConsumer: async (req, res) => {
    try {
      let validator = new v(req.query, {
        consumer_id: 'required'
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors });
      }

      if (req.query.for === 'cp') {
        // for channel partner 
        await ChannelPartners.update({
          is_deleted: true
        }, {
          where: {
            id: req.query.consumer_id
          }
        });

        //delete channel partner firms
        await DealerFirms.update({
          is_deleted: true
        }, {
          where: {
            dealer_id: req.query.consumer_id
          }
        })

        //delete consumer mobiles
        await DealerMobiles.update({
          is_deleted: true
        }, {
          where: {
            dealer_id: req.query.consumer_id
          }
        })
        return res.status(200).send({ success: '1', message: 'Channel Partner Deleted' })
      }

      //update delete flag for consumer model
      await consumerModel.update({
        is_deleted: true
      }, {
        where: {
          id: req.query.consumer_id
        }
      });
      //delete consumer firms
      // await DealerFirms.update({
      //     is_deleted: true
      // }, {
      //     where: {
      //         dealer_id: req.query.consumer_id
      //     }
      // })
      //delete consumer mobiles
      // await DealerMobiles.update({
      //     is_deleted: true
      // }, {
      //     where: {
      //         dealer_id: req.query.consumer_id
      //     }
      // })
      return res.status(200).send({ success: '1', message: 'Consumer Deleted' })
    }
    catch (error) {
      console.log("error in delete consumer", error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  addSecondaryFirmsById: async (req, res) => {
    try {
      console.log("add sec firm api");
      let validator = new v(req.body, {
        id: 'required',
        firm_name: 'required'
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors });
      }

      let dealer = await ChannelPartners.findOne({
        where: {
          id: req.body.id
        },
        raw: true
      })
      if (dealer) {
        let add_new_firm = await DealerFirms.create({
          id: uuid(),
          dealer_id: req.body.id,
          firm_name: req.body.firm_name
        });
        if (add_new_firm) {
          return res.status(200).send({ success: '1', message: 'created' })
        }
        else {
          return res.status(200).send({ success: '0', message: 'Error' })
        }
      } else {
        return res.status(200).send({ success: '0', message: 'Dealer Not Found' })
      }

    }
    catch (error) {
      console.log("error in ", error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  addSecondaryNumbersById: async (req, res) => {
    try {
      let validator = new v(req.body, {
        id: 'required',
        mobile: 'required'
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors });
      }
      let dealer_detail = await ChannelPartners.findOne({
        where: {
          id: req.body.id
        },
        raw: true
      });
      if (dealer_detail) {
        let create_ = await DealerMobiles.create({
          id: uuid(),
          dealer_id: req.body.id,
          mobile_no: req.body.mobile,
          country_code: "+91"
        });
        if (create_) {
          return res.status(200).send({ success: '1', message: 'created' })
        } else {
          return res.status(200).send({ success: '0', message: 'Error' })
        }
      } else {
        return res.status(200).send({ success: '0', message: 'Dealer Not Found' })
      }
    }
    catch (error) {
      console.log("error in ", error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  getSecondaryFirmsById: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: 'required',
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors })
      }
      let dealer_firms = await DealerFirms.findAll({
        where: {
          dealer_id: req.body.id,
          is_deleted: {
            [Op.ne]: true
          }
          // is_deleted: false
        }
      });
      return res.status(200).send({ success: '1', data: dealer_firms })
    }
    catch (error) {
      console.log("error in ", error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  getSecondaryNumbersById: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: 'required'
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors })
      };
      let dealer_numbers = await DealerMobiles.findAll({
        where: {
          dealer_id: req.body.id,
          id_deleted: false
        }
      })
      return res.status(200).send({ success: '0', data: dealer_numbers })
    }
    catch (error) {
      console.log("error in get numbers", error);
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  pendingVerificationDealer: async (req, res) => {
    try {
      let dealers = await consumerModel.findAll({
        where: {
          is_verified: false,
          is_deleted: false,
          type: { [Op.ne]: 0 }
        },
        raw: true
      });
      return res.status(200).send({ success: '1', data: dealers })
    }
    catch (err) {
      logger.error(req, err.message);
      return res.status(500).send({ success: '0', message: err.message })
    }
  },
  deleteSecondaryFirm: async (req, res) => {
    try {
      let validator = new v(req.query, {
        firm_id: "required"
      })
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', menubar: validator.errors })
      }
      await DealerFirms.update({
        is_deleted: true
      }, {
        where: {
          id: req.query.firm_id
        }
      });
      return res.status(200).send({ success: '1', message: 'deleted' })
    }
    catch (error) {
      logger.error(req, error);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  deleteSecondaryMobile: async (req, res) => {
    try {
      console.log("delete secondary mobile");
      let validator = new v(req.query, {
        mobile_id: "required"
      })
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', menubar: validator.errors })
      }
      await DealerMobiles.update({
        is_deleted: true
      }, {
        where: {
          id: req.query.mobile_id
        }
      });
      return res.status(200).send({ success: '1', message: 'deleted' })
    }
    catch (error) {
      logger.error(req, error);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  verifyDealer: async (req, res) => {
    try {
      let validator = new v(req.body, {
        dealer_id: 'required',
        status: 'required'
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors })
      }
      if (req.body.status == false) {
        await consumerModel.update({
          is_verified: false,
          is_deleted: true
        }, {
          where: {
            id: req.body.dealer_id
          }
        })
      } else {
        await consumerModel.update({
          is_verified: true
        }, {
          where: {
            id: req.body.dealer_id
          }
        })
      }
      return res.status(200).send({ success: '1', message: 'updated' })
    }
    catch (error) {
      logger.error(req, error);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  getScannedHistory: async (req, res) => {
    try {
      let validator = new v(req.query, {
        consumer_id: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: validator.errors })
      }

      if (req.query.for === "cp") {
        let consumerDetail = await ChannelPartners.findOne({
          where: { id: req.query.consumer_id },
          raw: true.query,
          attributes: ['id', 'phone', 'points', 'blocked_points', 'utilize_points', 'createdAt']
        });
        //get all secondary numbers/consumers
        let secConsumers = await DealerMobiles.findAll({
          where: {
            dealer_id: req.query.consumer_id
          },
          raw: true,
          attributes: ['id']
        })
        let allConsumerNos = secConsumers.map(x => x.id);
        allConsumerNos.push(req.query.consumer_id);

        let UID = moment(consumerDetail.createdAt).format('MM_YY')
        let dynamicCustomerProduct = await DynamicModels.getCustomerProductsModel(UID);

        console.log("customModel >>>>>>>>", dynamicCustomerProduct);
        dynamicCustomerProduct.hasOne(products, {
          foreignKey: 'id',
          sourceKey: 'product_id'
        });

        let scanned = await dynamicCustomerProduct.findAll({
          where: {
            customer_id: allConsumerNos
          },
          include: [{
            model: products,
            attributes: ['sku']
          }]
        });

        console.log("scanned>>>", scanned);
        let totalEarned = consumerDetail.points;
        let totalRedeemed = consumerDetail.blocked_points + consumerDetail.utilize_points;

        UID = moment(consumerDetail.createdAt).format('YY');
        dynamicRewardHistoryModel = await DynamicModels.rewardHistoryModel(UID);
        console.log("dynamicRewardHistoryModel>>>>", dynamicRewardHistoryModel);

        let totalRequestRejected = await dynamicRewardHistoryModel.count({
          where: {
            consumer_id: req.query.consumer_id,
            is_verified: 1,
          },
          raw: true,
        });

        let totalRequest = await dynamicRewardHistoryModel.count({
          where: {
            consumer_id: req.query.consumer_id,
          },
          raw: true,
        });

        return res.status(200).send({ success: '1', data: scanned, totalEarned: totalEarned, totalRedeemed: totalRedeemed, mobileno: consumerDetail.phone, totalRequestRejected: totalRequestRejected, totalRequest: totalRequest })
      }

      console.log("----------------API-------------------------");
      let consumerDetail = await consumerModel.findOne({
        where: { id: req.query.consumer_id },
        raw: true,
        attributes: ['id', 'phone', 'points', 'blocked_points', 'utilize_points', 'createdAt']
      })
      console.log("cid>>", req.query.consumer_id);
      let consumerIds = req.query.consumer_id;
      console.log("after", consumerIds);

      let UID = moment(consumerDetail.createdAt).format('MM_YY');
      let dynamicCustomerProduct = await DynamicModels.getCustomerProductsModel(UID);

      console.log("customModel >>>>>>>>", dynamicCustomerProduct);
      dynamicCustomerProduct.hasOne(products, {
        foreignKey: 'id',
        sourceKey: 'product_id'
      })

      let scanned = await dynamicCustomerProduct.findAll({
        where: {
          customer_id: consumerIds
        },
        include: [{
          model: products,
          attributes: ['sku']
        }
        ]
      });

      console.log("scanned>>>", scanned);
      let totalEarned = consumerDetail.points;
      let totalRedeemed = consumerDetail.blocked_points + consumerDetail.utilize_points;

      UID = moment(consumerDetail.createdAt).format('YY');
      dynamicRewardHistoryModel = await DynamicModels.rewardHistoryModel(UID);
      console.log("dynamicRewardHistoryModel>>>>", dynamicRewardHistoryModel);

      let totalRequestRejected = await dynamicRewardHistoryModel.count({
        where: {
          consumer_id: req.query.consumer_id,
          is_verified: 1,
        },
        raw: true,
      });

      let totalRequest = await dynamicRewardHistoryModel.count({
        where: {
          consumer_id: req.query.consumer_id,
        },
        raw: true,
      });

      return res.status(200).send({ success: '1', data: scanned, totalEarned: totalEarned, totalRedeemed: totalRedeemed, mobileno: consumerDetail.phone, totalRequestRejected: totalRequestRejected, totalRequest: totalRequest })
    }
    catch (error) {
      console.log("errors>>>>", error)
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  getProductComlpaints: async (req, res) => {
    try {
      let complaints = await ProductComplaints.findAll({
        include: [{
          model: products,
          attributes: ['sku']
        }, {
          model: consumerModel,
          attributes: ['name', 'phone']
        }, {
          model: DealerMobiles,
          attributes: ['mobile_no', 'dealer_id']
        }
        ],
        raw: true,
        nest: true
      });
      console.log("compalint", complaints);
      let data = []
      let obj = {}
      for (let i = 0; i < complaints.length; i++) {
        obj.id = complaints[i].id
        obj.sku = complaints[i].product.sku
        obj.qr_code = complaints[i].code
        obj.createdAt = complaints[i].createdAt
        if (complaints[i].consumer.name == null) {
          let dealer = await consumerModel.findOne({
            where: { id: complaints[i].dealer_mobileno.dealer_id },
            raw: true,
            attributes: ['name', 'phone']
          })
          obj.consumer_name = dealer.name
          obj.mobile_no = complaints[i].dealer_mobileno.mobile_no
        } else {
          obj.consumer_name = complaints[i].consumer.name
          obj.mobile_no = complaints[i].consumer.phone
        }
        data.push(obj);
      }
      return res.status(200).send({ success: '1', data: data })
    }
    catch (err) {
      logger.error(req, err);
      return res.status(500).send({ success: '0', message: err.message })
    }
  },
  getProductComlpaintDetails: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: "required"
      })
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: 'id id required' })
      }
      let complaint = await ProductComplaints.findOne({
        where: {
          id: req.query.id
        },
        include: [{
          model: products,
          attributes: ['sku']
        }, {
          model: consumerModel,
          attributes: ['name', 'phone', 'type']
        }, {
          model: DealerMobiles,
          attributes: ['mobile_no', 'dealer_id']
        }
        ],
        raw: true,
        nest: true
      });
      if (!complaint) {
        return res.status(200).send({ success: '0', message: 'invalid complaint id' })
      }
      let name, phone, type, front, back, bill;
      if (complaint.consumer.name == null) {
        let dealer = await consumerModel.findOne({
          where: { id: complaint.dealer_mobileno.dealer_id },
          raw: true,
          attributes: ["name", "type"]
        });
        if (dealer.type == 0) {
          type = "Customer"
        } else if (dealer.type == 1) {
          type = "Distributor"
        } else if (dealer.type == 2) {
          type = "Wholesaler"
        } else if (dealer.type == 3) {
          type = "Retailer"
        }
        name = dealer.name
        phone = complaint.dealer.mobile_no
      } else {
        if (complaint.consumer.type == 0) {
          type = "Customer"
        } else if (complaint.consumer.type == 1) {
          type = "Distributor"
        } else if (complaint.consumer.type == 2) {
          type = "Wholesaler"
        } else if (complaint.consumer.type == 3) {
          type = "Retailer"
        }
        name = complaint.consumer.name
        phone = complaint.consumer.phone
      }
      front = process.env.SITEURL + "reports/" + complaint.front_image;
      back = process.env.SITEURL + "reports/" + complaint.back_image;
      bill = process.env.SITEURL + "reports/" + complaint.purchased_bill;

      let obj = {
        name: name,
        type: type,
        sku: complaint.product.sku,
        code: complaint.code,
        phone: phone,
        complaintDate: complaint.createdAt,
        frontImage: front,
        backImage: back,
        billImage: bill,
        complaintMsg: complaint.complain_message

      }
      return res.status(200).send({ success: '1', data: obj })
    }
    catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  getSkuList: async (req, res) => {
    try {
      let products_list = await products.findAll({
        raw: true,
        attributes: ["id", "sku"]
      });
      return res.status(200).send({ success: '1', data: products_list })
    }
    catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  updateProductView: async (req, res) => {
    try {
      console.log("reeeqq", req.files, req.body);
      if (req.body.product_id == null || req.body.product_id == undefined) {
        return res.status(200).send({ success: '0', message: 'product id is required' });
      }
      let product_details = await ProductView.findOne({
        where: { product_id: req.body.product_id },
        raw: true
      });
      if (!product_details) {
        return res.status(200).send({ success: '0', message: 'product not found' })
      }
      let obj = {}

      if (req.body.vlog != null && req.body.vlog != undefined) {
        obj.vlog = req.body.vlog
      }
      if (req.body.blog != null && req.body.blog != undefined) {
        obj.blog = req.body.blog
      }
      //time update
      if (req.body.time != null && req.body.time != undefined && req.body.time.length > 0) {
        let tempTime = JSON.parse(req.body.time);
        let preDefinedTime = ["time_0", "time_1", "time_2"];
        obj.time = [];
        for (let i = 0; i < tempTime.length; i++) {
          if (preDefinedTime.includes(tempTime[i].name) && tempTime[i].status == true) {
            obj.time.push(tempTime[i].name)
          }
        }
      }
      //when to use update
      if (req.body.when_to_use != null && req.body.when_to_use != undefined && req.body.when_to_use.length > 0) {
        let tempWhen = JSON.parse(req.body.when_to_use);
        let preDefinedWhen = ["when_to_use_0", "when_to_use_1", "when_to_use_2", "when_to_use_3"];
        obj.when_to_use = [];
        for (let i = 0; i < tempWhen.length; i++) {
          if (preDefinedWhen.includes(tempWhen[i].name) && tempWhen[i].status == true) {
            obj.when_to_use.push(tempWhen[i].name)
          }
        }
      }

      //where to use update
      if (req.body.where_to_use != null && req.body.where_to_use != undefined && req.body.where_to_use.length > 0) {
        let tempWhere = JSON.parse(req.body.where_to_use);
        let preDefinedWhere = ["where_to_use_0", "where_to_use_1", "where_to_use_2", "where_to_use_3", "where_to_use_4"];
        obj.where_to_use = [];
        for (let i = 0; i < tempWhere.length; i++) {
          if (preDefinedWhere.includes(tempWhere[i].name) && tempWhere[i].status == true) {
            obj.where_to_use.push(tempWhere[i].name)
          }
        }
      }

      //pest update
      if (req.body.pest != null && req.body.pest != undefined && req.body.pest.length > 0) {
        let tempPest = JSON.parse(req.body.pest);
        let preDefinedPest = ["pest_0", "pest_1", "pest_2", "pest_3", "pest_4"];
        obj.pest = [];
        for (let i = 0; i < tempPest.length; i++) {
          if (preDefinedPest.includes(tempPest[i].name) && tempPest[i].status == true) {
            obj.pest.push(tempPest[i].name)
          }
        }
      }

      //dilutionl update
      if (req.body.dilutionl != null && req.body.dilutionl != undefined && req.body.dilutionl.length > 0) {
        let tempDilution = JSON.parse(req.body.dilutionl);
        console.log("left dil", tempDilution);
        let preDefinedDilution = ["dilution_left_0", "dilution_left_1", "dilution_left_2", "dilution_left_3"];
        obj.dilution = [];
        for (let i = 0; i < tempDilution.length; i++) {
          if (preDefinedDilution.includes(tempDilution[i].name) && tempDilution[i].status == true) {
            obj.dilution.push(tempDilution[i].name)
          }
        }
      }

      //dilutionr update
      if (req.body.dilutionr != null && req.body.dilutionr != undefined && req.body.dilutionr.length > 0) {
        let tempDilution = JSON.parse(req.body.dilutionr);
        let preDefinedDilution = ["dilution_right_0", "dilution_right_1", "dilution_right_2", "dilution_right_3"];
        for (let i = 0; i < tempDilution.length; i++) {
          if (preDefinedDilution.includes(tempDilution[i].name) && tempDilution[i].status == true) {
            obj.dilution.push(tempDilution[i].name)
          }
        }
      }

      //check image1
      if (req.files && req.files.image1 != null) {
        if (!ValidateFileType(req.files.image1)) {
          return res
            .status(200)
            .send({ success: "0", message: "image 1 type is not valid" });
        }
        if (!ValidateFileSize(req.files.image1, 700000)) {
          return res
            .status(200)
            .send({ success: "0", message: "image size should be less than 700KB" });
        }
        //delete existing image1
        if (product_details.image_1 != null) {
          let existing_imagedir = path.join("uploads/rewards/", product_details.image_1);
          if (fs.existsSync(existing_imagedir)) {
            fs.unlinkSync(existing_imagedir, function (err) {
              console.log("error in delete old image file", err);
            });
          }
        }

        //upload new image1
        let productImage = req.files.image1;
        let date = new Date();

        let imgName =
          date.getTime() +
          randomstring.generate(10) +
          path.extname(productImage.name);

        if (!fs.existsSync(productImageDir)) {
          fs.mkdirSync(productImageDir);
        }
        obj.image_1 = imgName;
        productImage.mv(productImageDir + imgName, function (err) {
          if (err) return res.status(500).send({ success: "0", message: err });
        });
      }
      //check image2
      if (req.files && req.files.image2 != null) {
        if (!ValidateFileType(req.files.image2)) {
          return res
            .status(200)
            .send({ success: "0", message: "image 2 type is not valid" });
        }
        if (!ValidateFileSize(req.files.image2, 700000)) {
          return res
            .status(200)
            .send({ success: "0", message: "image size should be less than 700KB" });
        }
        //delete existing image2
        if (product_details.image_2 != null) {
          let existing_imagedir = path.join("uploads/rewards/", product_details.image_2);
          if (fs.existsSync(existing_imagedir)) {
            fs.unlinkSync(existing_imagedir, function (err) {
              console.log("error in delete old image file", err);
            });
          }
        }

        //upload new image2
        let productImage = req.files.image2;
        let date = new Date();

        let imgName =
          date.getTime() +
          randomstring.generate(10) +
          path.extname(productImage.name);

        if (!fs.existsSync(productImageDir)) {
          fs.mkdirSync(productImageDir);
        }

        obj.image_2 = imgName;

        productImage.mv(productImageDir + imgName, function (err) {
          if (err) return res.status(500).send({ success: "0", message: err });
        });
      }
      //check image3
      if (req.files && req.files.image3 != null) {
        if (!ValidateFileType(req.files.image3)) {
          return res
            .status(200)
            .send({ success: "0", message: "image 3 type is not valid" });
        }
        if (!ValidateFileSize(req.files.image3, 700000)) {
          return res
            .status(200)
            .send({ success: "0", message: "image size should be less than 700KB" });
        }
        //delete existing image1
        if (product_details.image_3 != null) {
          let existing_imagedir = path.join("uploads/rewards/", product_details.image_3);
          if (fs.existsSync(existing_imagedir)) {
            fs.unlinkSync(existing_imagedir, function (err) {
              console.log("error in delete old image file", err);
            });
          }
        }

        //upload new image1
        let productImage = req.files.image3;
        let date = new Date();

        let imgName =
          date.getTime() +
          randomstring.generate(10) +
          path.extname(productImage.name);

        if (!fs.existsSync(productImageDir)) {
          fs.mkdirSync(productImageDir);
        }

        obj.image_3 = imgName;

        productImage.mv(productImageDir + imgName, function (err) {
          if (err) return res.status(500).send({ success: "0", message: err });
        });
      }
      //check image 4
      if (req.files && req.files.image4 != null) {
        if (!ValidateFileType(req.files.image4)) {
          return res
            .status(200)
            .send({ success: "0", message: "image 4 type is not valid" });
        }
        if (!ValidateFileSize(req.files.image4, 700000)) {
          return res
            .status(200)
            .send({ success: "0", message: "image size should be less than 700KB" });
        }
        //delete existing image1
        if (product_details.image_4 != null) {
          let existing_imagedir = path.join("uploads/rewards/", product_details.image_4);
          if (fs.existsSync(existing_imagedir)) {
            fs.unlinkSync(existing_imagedir, function (err) {
              console.log("error in delete old image file", err);
            });
          }
        }

        //upload new image1
        let productImage = req.files.image4;
        let date = new Date();

        let imgName =
          date.getTime() +
          randomstring.generate(10) +
          path.extname(productImage.name);

        if (!fs.existsSync(productImageDir)) {
          fs.mkdirSync(productImageDir);
        }

        obj.image_4 = imgName;

        productImage.mv(productImageDir + imgName, function (err) {
          if (err) return res.status(500).send({ success: "0", message: err });
        });
      }

      await ProductView.update(obj,
        {
          where: {
            product_id: req.body.product_id
          }
        })

      return res.status(200).send({ success: '1', message: 'updated' })
    }
    catch (error) {
      console.log("error", error.message)
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  deleteProductImage: async (req, res) => {
    try {
      let validator = new v(req.body, {
        product_id: 'required',
        image_no: "required"
      });
      let matched = await validator.check();
      if (!matched || req.body.image_no <= 0 || req.body.image_no > 4) {
        return res.status(200).send({ success: '0', message: 'Image no is required' });
      }

      let productViewDetails = await ProductView.findOne({
        where: {
          product_id: req.body.product_id,
        }
      })

      if (!productViewDetails) {
        return res.status(200).send({ success: '0', message: 'Product Not Found' })
      }

      let image_name;
      if (req.body.image_no == 1) {
        image_name = productViewDetails.image_1;
        if (productViewDetails.image_1 == null) {
          return res.status(200).status({ success: '0', message: 'image not available' })
        }
        await productViewDetails.update({
          image_1: null
        })
      }
      if (req.body.image_no == 2) {
        image_name = productViewDetails.image_2;
        if (productViewDetails.image_2 == null) {
          return res.status(200).status({ success: '0', message: 'image not available' })
        }
        await productViewDetails.update({
          image_2: null
        })
      }
      if (req.body.image_no == 3) {
        image_name = productViewDetails.image_3;
        if (productViewDetails.image_3 == null) {
          return res.status(200).status({ success: '0', message: 'image not available' })
        }
        await productViewDetails.update({
          image_3: null
        })
      }
      if (req.body.image_no == 4) {
        image_name = productViewDetails.image_4;
        if (productViewDetails.image_4 == null) {
          return res.status(200).status({ success: '0', message: 'image not available' })
        }
        await productViewDetails.update({
          image_4: null
        })
      }
      let existing_imagedir = path.join("uploads/product_images/", image_name);
      if (fs.existsSync(existing_imagedir)) {
        fs.unlinkSync(existing_imagedir, function (err) {
          console.log("error in delete old image file", err);
          return res.status(200).send({ success: '0', message: 'Error in delete' })
        });
      }
      return res.status(200).send({ success: '1', message: 'Deleted' });
    }
    catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  getExtraDetails: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: 'required'
      })
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: "id is required" })
      }
      let productViewDetails = await ProductView.findOne({
        where: {
          product_id: req.query.id
        },
        raw: true
      });
      if (!productViewDetails) {
        return res.status(200).send({ success: '0', message: 'Product Details Not Found' })
      }
      let obj = {
        id: productViewDetails.id,
        product_id: productViewDetails.product_id,
      }
      if (productViewDetails.image_1 != null) {
        obj.image_1 = process.env.SITEURL + "product_images/" + productViewDetails.image_1;
      }
      if (productViewDetails.image_2 != null) {
        obj.image_2 = process.env.SITEURL + "product_images/" + productViewDetails.image_2;
      }
      if (productViewDetails.image_3 != null) {
        obj.image_3 = process.env.SITEURL + "product_images/" + productViewDetails.image_3;
      }
      if (productViewDetails.image_4 != null) {
        obj.image_4 = process.env.SITEURL + "product_images/" + productViewDetails.image_4;
      }
      if (productViewDetails.banner_1 != null) {
        obj.banner_1 = process.env.SITEURL + "product_images/" + productViewDetails.banner_1;
      }
      if (productViewDetails.banner_2 != null) {
        obj.banner_2 = process.env.SITEURL + "product_images/" + productViewDetails.banner_2;
      }
      if (productViewDetails.banner_3 != null) {
        obj.banner_3 = process.env.SITEURL + "product_images/" + productViewDetails.banner_3;
      }
      if (productViewDetails.banner_4 != null) {
        obj.banner_4 = process.env.SITEURL + "product_images/" + productViewDetails.banner_4;
      }
      if (productViewDetails.blog != null) {
        obj.blog = productViewDetails.blog
      }
      if (productViewDetails.vlog != null) {
        obj.vlog = productViewDetails.vlog
      }


      if (!productViewDetails) {
        return res.status(200).send({ success: '0', message: 'No Data Found' })
      }
      return res.status(200).send({ success: '1', data: obj })
    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  getProductUsageIconImages: async (req, res) => {
    try {
      let validator = new v(req.query, {
        product_id: 'required'
      });
      let matched = await validator.check();
      if (!matched) {
        return res.status(200).send({ success: '0', message: 'product_id is required' })
      }
      let time = [];
      let where_to_use = [];
      let when_to_use = [];
      let pest = [];
      let dilutionLeft = [];
      let dilutionRight = [];
      let timeCounter = 0;
      let whereToUseCounter = 0;
      let whenToUseCounter = 0;
      let pestCounter = 0;
      let dilutionLeftCounter = 0;
      let dilutionRightCounter = 0;
      let max = 0;
      let files = fs.readdirSync(productIconImagesDir);
      let productViewDetails = await ProductView.findOne({
        where: {
          product_id: req.query.product_id
        },
        raw: true
      })
      if (!productViewDetails) {
        return res.status(200).send({ sucess: '0', message: 'Product Details Not Found' })
      }
      max = files.length;
      for (let i = 0; i < files.length; i++) {
        if (files[i].includes("time")) {
          timeCounter++;
        }
        if (files[i].includes("where_to_use")) {
          whereToUseCounter++;
        }
        if (files[i].includes("when_to_use")) {
          whenToUseCounter++;
        }
        if (files[i].includes("pest")) {
          pestCounter++;
        }
        if (files[i].includes("dilution_left")) {
          dilutionLeftCounter++;
        }
        if (files[i].includes("dilution_right")) {
          dilutionRightCounter++
        }
      }
      for (let i = 0; i < max; i++) {
        if (i < timeCounter) {
          let t = {
            "name": 'time_' + i,
            "type": "time",
            "url": process.env.SITEURL + "product_use/time_" + i + ".png"
          }
          if (productViewDetails.time != null && productViewDetails.time.includes(t.name)) {
            t.status = true;
          } else {
            t.status = false;
          }
          console.log("in push");
          time.push(t);
        }
        if (i < whenToUseCounter) {
          let when = {
            "name": 'when_to_use_' + i,
            "type": "when_to_use",
            "url": process.env.SITEURL + "product_use/when_to_use_" + i + ".png"
          }
          if (productViewDetails.when_to_use != null && productViewDetails.when_to_use.includes(when.name)) {
            when.status = true;
          } else {
            when.status = false;
          }

          when_to_use.push(when);
        }
        if (i < whereToUseCounter) {
          let where = {
            "name": 'where_to_use_' + i,
            "type": "where_to_use",
            "url": process.env.SITEURL + "product_use/where_to_use_" + i + ".png"
          }
          if (productViewDetails.where_to_use != null && productViewDetails.where_to_use.includes(where.name)) {
            where.status = true;
          } else {
            where.status = false;
          }
          where_to_use.push(where);
        }
        if (i < pestCounter) {
          let p = {
            "name": 'pest_' + i,
            "type": "pest",
            "url": process.env.SITEURL + "product_use/pest_" + i + ".png"
          }
          if (productViewDetails.pest != null && productViewDetails.pest.includes(p.name)) {
            p.status = true;
          } else {
            p.status = false;
          }
          pest.push(p);
        }
        if (i < dilutionLeftCounter) {
          let dilutionl = {
            "name": 'dilution_left_' + i,
            "type": "dilutionl",
            "url": process.env.SITEURL + "product_use/dilution_left_" + i + ".png"
          }
          if (productViewDetails.dilution != null && productViewDetails.dilution.includes(dilutionl.name)) {
            dilutionl.status = true;
          } else {
            dilutionl.status = false;
          }
          dilutionLeft.push(dilutionl);
        }
        if (i < dilutionRightCounter) {
          let dilutionr = {
            "name": 'dilution_right_' + i,
            "type": "dilutionr",
            "url": process.env.SITEURL + "product_use/dilution_right_" + i + ".png"
          }
          if (productViewDetails.dilution != null && productViewDetails.dilution.includes(dilutionr.name)) {
            dilutionr.status = true;
          } else {
            dilutionr.status = false;
          }
          dilutionRight.push(dilutionr)
        }

      }
      let data = {
        time: time,
        whereToUse: where_to_use,
        whenToUse: when_to_use,
        pest: pest,
        dilutionLeft: dilutionLeft,
        dilutionRight: dilutionRight
      }
      return res.status(200).send({ success: '1', data: data })

    }
    catch (error) {
      console.log("error", error.message)
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  }
}
function ValidateFileType(files) {
  if (files.name.match(/\.(jpg|jpeg|png|gif|PNG|JPG|JPEG)$/)) {
    return true;
  }
  return false;
}
function ValidateFileSize(files, size) {
  if (files.size <= size) {
    return true;
  } else {
    return false;
  }
}

function isValidDateFormat(dateString) {
  // Regular expression to match the "DD/MM/YYYY" format
  const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;

  // Check if the input string matches the expected format
  const match = dateString.match(dateRegex);

  if (!match) {
    // If the input string doesn't match the format, it's invalid
    return false;
  }

  // Extract day, month, and year from the matched groups
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  // Create a new Date object and check its validity
  const date = new Date(year, month - 1, day);

  // Check if the date is valid and the input values match the resulting date
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isValidMobileNumber(mobileNumber) {
  // Regular expression to match a 10-digit number
  const mobileNumberRegex = /^\d{10}$/;

  // Check if the input string matches the expected format
  return mobileNumberRegex.test(mobileNumber);
}


module.exports = consumer