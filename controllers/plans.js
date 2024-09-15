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
const controllers = require("./_controller");
const plansController = {
  list: async (req, res) => {
    try {
      const plans = await Plans.findAll();
      const featureIds = [...new Set(plans.flatMap(plan => plan.features))];

      const features = await Features.findAll({
        where: { id: featureIds }
      });

      const featuresMap = features.reduce((map, feature) => {
        map[feature.id] = feature.name;
        return map;
      }, {});

      const plansWithFeatures = plans.map(plan => ({
        ...plan.toJSON(),
        features: plan.features.map(featureId => featuresMap[featureId])
      }));

      return res.status(200).send({ success: true, data: plansWithFeatures });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ success: false, message: error.message });
    }
  },
  add: async () => {
    try {

      let features = ["f0f25183-f28c-4037-992f-6ba7f6b7b26c", "bbd9d341-ce08-40a7-bd5a-30df8aa9fe0d", "8904ca83-d788-403a-ac5f-eedd9945754d", "c2e8ff6a-7717-43f2-b93d-9bc5d076a886", "ca580fbf-ba10-46d0-888d-b2a8e39deadf"];
      let name = "Titanium";
      let amount = 1000000;
      let period = "60 months";


      const newPlan = await Plans.create({
        id: uuid(),
        name,
        amount,
        period,
        features
      });

      console.log("added success");
    } catch (error) {
      console.error(error);
    }
  }
};

module.exports = plansController;
