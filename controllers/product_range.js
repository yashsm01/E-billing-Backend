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
const ProductRange = require("../models/").product_range;
const Category = require("../models/").categories;

const productRangeController = {
  list: async function (req, res) {
    try {
      let whereClause = {
        is_deleted: false
      }

      let allProductRange = await ProductRange.findAll({
        where: whereClause
      });
      return res.status(200).send({ success: 1, data: allProductRange })
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

      const isExist = await ProductRange.count({
        where: {
          //name: req.body.name,
          name: { [Op.iLike]: req.body.name }
        },
      });

      if (isExist > 0) {
        return res.status(200).send({
          success: 0,
          message: `Product range already found!`,
        });
      }

      let productRangeId = uuid();
      await ProductRange.create({
        id: productRangeId,
        name: req.body.name,
        status: true,
        is_deleted: false
      })

      return res.status(200).send({
        success: 1,
        message: "Product range added successfully."
      });

    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  productCategory: async (req, res) => {
    console.log('>>>>>>>>>>>>reabody');
    try {
      let whereClause = {
        is_deleted: false
      }

      let category = await Category.findAll({
        where: whereClause,
        attributes: ["name", "id"],
        raw: true,
        nest: true
      });
      return res.status(200).send({ success: 1, data: category })
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  }
}
module.exports = productRangeController;