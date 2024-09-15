const v = require("node-input-validator");
const uuid = require("uuid");
const randomstring = require("randomstring");
const fs = require("fs");
const path = require("path");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const db = require('../models');

//middleware
const message = require("../i18n/en");
let AddInProgress = false;
let updateInProgress = false;

// models
let models = require("./_models");
const Plans = models.plansModel;
const Features = models.featuresModel;

// controller
const featuresController = {
  list: async (req, res) => {
    try {
      let allFeatures = await Features.findAll({
        order: [['name', 'ASC']],
        raw: true,
        nest: true
      });
      return res.status(200).send({ success: 1, data: allFeatures });
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  }
};

module.exports = featuresController;


