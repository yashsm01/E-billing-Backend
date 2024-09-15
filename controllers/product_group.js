const v = require("node-input-validator");
const uuid = require("uuid");
const randomstring = require("randomstring");
const fs = require("fs");
const path = require("path");
const { Client } = require('pg');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

//middleware
const message = require("../i18n/en");
const logger = require('../helpers/logger');
const parseValidate = require('./../middleware/parseValidate');

// models
const ProductGroup = require("../models").product_group;

const productGroupController = {
  list: async function (req, res) {
    try {
      let whereClause = {
        is_deleted: false
      }

      let allProductGroup = await ProductGroup.findAll({
        where: whereClause
      });
      return res.status(200).send({ success: 1, data: allProductGroup })
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },

  add: async function (req, res) {
    try {

      let validator = new v(req.body, {
        name: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      const isExist = await ProductGroup.count({
        where: {
          //name: req.body.name,
          name: { [Op.iLike]: req.body.name }
        },
      });

      if (isExist > 0) {
        return res.status(200).send({
          success: 0,
          message: `Product group already found!`,
        });
      }

      let productGroupId = uuid();
      await ProductGroup.create({
        id: productGroupId,
        name: req.body.name,
        status: true,
        is_deleted: false
      })

      return res.status(200).send({
        success: 1,
        message: "Product group added successfully."
      });

    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  }
}
module.exports = productGroupController;