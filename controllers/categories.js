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
const { BIGINT } = require("sequelize");
const { UUID } = require("sequelize");
const { orderBy } = require("lodash");

// models
const Category = require("../models/").categories;

//validator

const CategoryController = {
  list: async function (req, res) {
    try {
      let whereClause = {
        is_deleted: false
      }

      let allProductCategory = await Category.findAll({
        where: whereClause
      });
      return res.status(200).send({ success: 1, data: allProductCategory })
    } catch (error) {
      console.error(error);
      console.error(error.message);
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
        code: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      const isExistName = await Category.count({
        where: {
          name: { [Op.iLike]: req.body.name }
        },
      });
      const isExistCode = await Category.count({
        where: {
          code: { [Op.iLike]: req.body.code }
        },
      });
      if (isExistCode > 0 || isExistName > 0) {
        return res.status(200).send({
          success: 0,
          message: `Product category already found!`,
        });
      }

      let lastCategoryId = await Category.findOne({
        order: [['id', 'DESC']]
      });
      await Category.create({
        id: lastCategoryId.id + 1,
        name: req.body.name,
        code: req.body.code,
        status: true,
        is_deleted: false
      })

      return res.status(200).send({
        success: 1,
        message: "Product Category added successfully."
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
module.exports = CategoryController;