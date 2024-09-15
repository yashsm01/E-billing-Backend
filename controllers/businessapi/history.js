
const BusinessConsignment = require('../../models').business_consignment;
const BusinessUser = require('../../models').company_users;
const consignmentUnits = require('../../models').consignment_unit;
const BusinessConsignmentShipper = require('../../models').business_consignment_shipper;
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const logger = require('../../helpers/logger');

const limit = 25;

let historycontroller = {

  outwardsHistory: async function (req, res) {

    let page = (req.params.page > 0) ? req.params.page : 1;
    let offset = (page - 1) * limit;
    let response;
    try {

      BusinessUser.hasOne(BusinessConsignment, { foreignKey: 'to_id' });
      BusinessConsignment.belongsTo(BusinessUser, { foreignKey: 'to_id' });

      let where;
      if (typeof req.params.key_word !== "undefined" && req.params.key_word != "") {
        where = {
          [Op.or]: [{
            is_deleted: false,
          }, {
            is_deleted: null,
          }],
          from_id: req.headers['x-key'],
          status: {
            [Op.in]: [4, 5]
          },
          invoice_no: {
            [Op.like]: '%' + req.params.key_word + '%'
          }
        };
      } else {
        where = {
          [Op.or]: [{
            is_deleted: false,
          }, {
            is_deleted: null,
          }],
          from_id: req.headers['x-key'],
          status: {
            [Op.in]: [4, 5]
          }
        };
      }

      let outWardRes = await BusinessConsignment.findAll({
        where: where,
        attributes: ["id", "to_id", "invoice_no", "date", "current_scan", "status", "reason", "createdAt"],
        include: [{
          model: BusinessUser,
          attributes: ["name", "last_name"]
        }, {
          model: consignmentUnits,
        }],
        limit: limit,
        offset: offset,
        order: [['createdAt', 'DESC']]
      });

      if (outWardRes.length > 0) {
        for (let i = 0; i < outWardRes.length; i++) {
          outWardRes[i].current_scan = (outWardRes[i].current_scan != null) ? outWardRes[i].current_scan : "0";
        }
        response = {
          success: 1,
          "data": outWardRes
        };
      } else {

        response = {
          success: 1,
          message: "No data found!"
        };
      }

      return res.status(200).send(response);
    } catch (ex) {
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },

  inwardsHistory: async function (req, res) {

    let page = (req.params.page > 0) ? req.params.page : 1;
    let offset = (page - 1) * limit;
    let response;
    try {

      BusinessUser.hasOne(BusinessConsignment, { foreignKey: 'from_id' });
      BusinessConsignment.belongsTo(BusinessUser, { foreignKey: 'from_id' });

      let where;
      if (typeof req.params.key_word !== "undefined" && req.params.key_word != "") {
        where = {
          [Op.or]: [{
            is_deleted: false,
          }, {
            is_deleted: null,
          }],
          to_id: req.headers['x-key'],
          status: {
            [Op.in]: [5, 6]
          },
          invoice_no: {
            [Op.substring]: req.params.key_word
          }
        };
      } else {
        where = {
          [Op.or]: [{
            is_deleted: false,
          }, {
            is_deleted: null,
          }],
          to_id: req.headers['x-key'],
          status: {
            [Op.in]: [5, 6]
          }
        };
      }

      let inWardRes = await BusinessConsignment.findAll({
        where: where,
        attributes: ["id", "from_id", "invoice_no", "date", "current_scan", "status", "createdAt"],
        include: [{
          model: BusinessUser,
          attributes: ["name", "last_name"]
        }, {
          model: BusinessConsignmentShipper,
          attributes: ['is_damage', 'is_received', 'is_return'],
          [Op.or]: [{
            is_deleted: false,
          }, {
            is_deleted: null,
          }],
        }, {
          model: consignmentUnits,
        }],
        limit: limit,
        offset: offset,
        order: [['createdAt', 'DESC']]
      });

      if (inWardRes.length) {

        for (let i = 0; i < inWardRes.length; i++) {

          inWardRes[i].current_scan = (inWardRes[i].current_scan != null) ? inWardRes[i].current_scan : "0";
          if (inWardRes[i].business_consignment_shipper && inWardRes[i].business_consignment_shipper.length > 0) {
            inWardRes[i].dataValues.damageCount = inWardRes[i].business_consignment_shipper.filter(x => x.is_damage == true).length;
            inWardRes[i].dataValues.shortageCount = inWardRes[i].business_consignment_shipper.filter(x => x.is_received == false).length;
            inWardRes[i].dataValues.returnCount = inWardRes[i].business_consignment_shipper.filter(x => x.is_return == false).length;
          } else {
            inWardRes[i].dataValues.damageCount = 0;
            inWardRes[i].dataValues.shortageCount = 0;
            inWardRes[i].dataValues.returnCount = 0;
          }

        }
        response = { success: 1, "data": inWardRes };
      } else {

        response = { success: 1, message: "No data found!" };
      }

      return res.status(200).send(response);
    } catch (ex) {
      logger.error(req, ex.message);
      console.error(ex);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },

  retrunHistory: async function (req, res) {

    let page = (req.params.page > 0) ? req.params.page : 1;
    let limit = 10;
    let offset = (page - 1) * limit;
    let response;
    try {

      BusinessUser.hasOne(BusinessConsignment, { foreignKey: 'from_id' });
      BusinessConsignment.belongsTo(BusinessUser, { foreignKey: 'from_id' });

      let where;
      if (typeof req.params.key_word !== "undefined" && req.params.key_word != "") {
        where = {
          [Op.or]: [{
            is_deleted: false,
          }, {
            is_deleted: null,
          }],
          type: 2,
          status: {
            [Op.in]: [7, 8, 9]
          },
          invoice_no: {
            [Op.substring]: req.params.key_word
          },
          to_id: req.headers['x-key']
        }

      } else {
        where = {
          [Op.or]: [{
            is_deleted: false,
          }, {
            is_deleted: null,
          }],
          type: 2,
          status: {
            [Op.in]: [7, 8, 9]
          },
          to_id: req.headers['x-key']
        }
      }

      let inWardRes = await BusinessConsignment.findAll({
        where: where,
        attributes: ["id", "invoice_no", "date", "current_scan", "status"],
        include: [{
          model: BusinessUser,
          attributes: ["name", "last_name"]
        }],
        limit: limit,
        offset: offset,
        order: [['createdAt', 'DESC']],
      });

      if (inWardRes.length) {
        let data = [];

        let bcs;
        for (let i = 0; i < inWardRes.length; i++) {
          bcs = await BusinessConsignmentShipper.count({
            where: {
              consignment_id: inWardRes[i].id
            }
          });

          if (bcs == 0) {
            await BusinessConsignment.destroy({
              where: {
                id: inWardRes[i].id
              }
            });
          } else {
            inWardRes[i].current_scan = (inWardRes[i].current_scan != null) ? inWardRes[i].current_scan : "0";
            data.push(inWardRes[i]);
          }
        }

        response = { success: 1, "data": data };
      } else {
        response = { success: 1, message: "No data found!" };
      }

      return res.status(200).send(response);
    } catch (ex) {
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
}

module.exports = historycontroller;
