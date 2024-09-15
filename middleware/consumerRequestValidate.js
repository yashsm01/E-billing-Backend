const ConsumerModel = require('../models/').consumers;
const ChannelPartners = require("../models").channel_partners;
const secondaryConsumers = require('../models/').dealer_mobileno;
const SalesPerson = require('../models/').sales_persons;
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const JWT = require('jsonwebtoken');

module.exports = async (req, res, next) => {
  try {
    let token = (req.body && req.body.access_token) || (req.query && req.query.access_token) || req.headers['x-access-token'];
    if (token) {
      console.log("token", token)
      let decodedToken = await JWT.verify(token, require('../config/secret')());
      let isPrimary = false, roleId, consumerId;
      let userDetails;
      // normal consumer
      let consumerDetail = await ConsumerModel.findOne({
        where: {
          id: decodedToken.userId,
          jwt_token: token
        },
        raw: true
      });
      if (consumerDetail) {
        isPrimary = true;
        roleId = consumerDetail.role_id;   // 0
        consumerId = consumerDetail.id;
        userDetails = consumerDetail;
      }
      else {
        // channel partner
        let channelPartners = await ChannelPartners.findOne({
          where: {
            id: decodedToken.userId,
            jwt_token: token
          }
        })
        if (channelPartners) {
          isPrimary = false;
          roleId = channelPartners.role_id;   // otherthan 0
          consumerId = channelPartners.id;
          userDetails = channelPartners;
        }
        else {
          return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
          // sec channel partner
          // let secChannelPartner = await secondaryConsumers.findOne({
          //   where: {
          //     id: decodedToken.userId,
          //     jwt_token: token
          //   }
          // })
          // if(secChannelPartner){
          //   isPrimary = false;
          //   roleId = secChannelPartner.role_id; // nned to check
          //   consumerId = secChannelPartner.id;
          //   userDetails = secChannelPartner;
          // }
          // else{
          //   return res.status(401).send({ success: 0, message: "Invalid Token or Key" }); 
          // }
        }


        // let secConsumerDetail = await SecondaryConsumerModel.findOne({
        //   where: Sequelize.where(
        //     Sequelize.fn("concat", Sequelize.col('country_code'), Sequelize.col('mobile_no')),
        //     { [Op.like]: decodedToken.phone_number }
        //   ),
        //   raw: true
        // });
        // if (secConsumerDetail) {
        //   isPrimary = false;
        //   consumerId = secConsumerDetail.id;
        //   let dealerDetail = await ConsumerModel.findOne({
        //     where: {
        //       id: secConsumerDetail.dealer_id
        //     },
        //     raw: true
        //   });
        //   roleId = dealerDetail.type;
        //   userDetails = secConsumerDetail
        // }
        // else {

        //   let salesPersonDetail = await SalesPerson.findOne({
        //     where: {
        //       id: decodedToken.userId,
        //       jwt_token: token
        //     },
        //     raw: true
        //   });
        //   if (salesPersonDetail) {
        //     consumerId = salesPersonDetail.id;
        //     roleId = salesPersonDetail.type
        //     userDetails = salesPersonDetail
        //   }
        //   else {
        //     return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
        //   }
        // }
      }
      req.cityId = userDetails.city_id;
      req.consumerId = consumerId;
      req.isPrimary = isPrimary;
      req.roleId = roleId;
      req.createdAt = userDetails.createdAt
      next();
    } else {
      console.log('3>>>>>>>>>>>')
      return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
    }
  } catch (ex) {
    console.log(ex);
    console.log('4>>>>>>>>>>>')
    return res.status(401).send({ success: 0, message: "Invalid Token or Key" });
  }
};
