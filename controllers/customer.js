const v = require("node-input-validator");
const uuid = require("uuid");
const logger = require("../helpers/logger");
const LocationModel = require("../models").locations;
const storageBins = require("../models").storage_bins;
const financeLocationModal = require("../models").finance_location;
const parseValidate = require('./../middleware/parseValidate');
const Sequelize = require('sequelize');
const finance_location = require("../models/finance_location");
const Op = Sequelize.Op;
let addInProcess = false;
const CountryModel = require('../models/').countries;
const StateModel = require('../models/').state;
const CityModel = require('../models/').city;



financeLocationModal.hasMany(LocationModel, { foreignKey: "finance_location_id" });
LocationModel.belongsTo(financeLocationModal, { foreignKey: "finance_location_id" });

const customer = {
  add: async (req, res) => {
    try {
      let validator = new v(req.body, {
        uniqueName: "required",
        name: "required",
        address: "required",
        // countryId: "required",
        stateId: "required",
        cityId: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: validatorError });
      }

      let count = await LocationModel.count({
        where: {
          unique_name: req.body.uniqueName,
          is_deleted: false
        }
      });
      if (count > 0) {
        return res.status(200).send({ success: 0, message: "Location is already added!" });
      }

      let loactionId = uuid();
      await LocationModel.create({
        id: loactionId,
        unique_name: req.body.uniqueName.toUpperCase(),
        name: req.body.name,
        country_id: "101",
        state_id: req.body.stateId,
        city_id: req.body.cityId,
        address: req.body.address,
        is_customer: true,
        customer_status: true
      });
      //add intransit bin while adding a location
      await storageBins.create({
        name: "In Transit",
        location_id: loactionId,
      });
      await storageBins.create({
        name: "OK",
        location_id: loactionId,
        is_default_bin: true
      });
      await storageBins.create({
        name: "Damage",
        location_id: loactionId,
      });
      await storageBins.create({
        name: "Missing",
        location_id: loactionId,
      });

      return res.send({ success: 1, message: "Location Added Successfully!" });
    }
    catch (error) {
      console.log(error);
      logger.error(req, error.message);
      console.log("error", error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },

  /**
   * @owner Kapil
   * @description get locations details
   */

  getList: async (req, res) => {
    try {
      let whereClause = {};
      if ([3, 21].includes(req.roleId)) {
        whereClause.id = req.locationId;
      }
      whereClause.is_customer = true;
      let locations = await LocationModel.findAll({
        where: whereClause,
        include: [
          {
            model: CityModel,
            attributes: ['id', 'name'],
            include: [
              {
                model: StateModel,
                attributes: ['id', 'name'],
                include: [
                  {
                    model: CountryModel,
                    attributes: ['id', 'name'],
                    as: 'country'
                  }
                ],
                as: 'state',
                raw: true,
                nest: true
              }
            ],
            as: 'city',
            raw: true,
            nest: true
          },
        ],
        order: [['createdAt', 'DESC']],
        raw: true,
        nest: true
      });
      return res.status(200).send({ success: 1, data: locations });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  getCustomers: async (req, res) => {
    try {
      let customers = await LocationModel.findAll({
        where: {
          is_customer: true,
        },
        // include: [
        //   {
        //     model: financeLocationModal,
        //     attributes: ["code"],
        //   }
        // ],
        include: [
          {
            model: CityModel,
            attributes: ['id', 'name'],
            include: [
              {
                model: StateModel,
                attributes: ['id', 'name'],
                include: [
                  {
                    model: CountryModel,
                    attributes: ['id', 'name'],
                    as: 'country',
                    raw: true,
                    nest: true
                  }
                ],
                as: 'state',
                raw: true,
                nest: true
              }
            ],
            as: 'city',
            raw: true,
            nest: true
          },
        ],
        order: [["unique_name", "ASC"]],
        raw: true,
        nest: true
      });

      for (let item of customers) {
        // -----
        if (item.finance_locations) {
          let financeLocations = await financeLocationModal.findAll({
            where: {
              id: { [Op.in]: item.finance_locations }
            },
            raw: true,
            attributes: ['code']
          });
          console.log(">>>>>financeLocations", financeLocations);
          let data = financeLocations.map(el => { return el.code })
          item.financeLocations = data.join(',');
        }
      }
      return res.status(200).send({ success: 1, data: customers });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },

  getDetailsById: async (req, res) => {
    try {
      let validator = new v(req.query, {
        id: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: validatorError });
      }

      let location = await LocationModel.findOne({
        where: {
          is_deleted: false,
          id: req.query.id
        },
        include: [
          {
            model: CityModel,
            attributes: ['id', 'name'],
            include: [
              {
                model: StateModel,
                attributes: ['id', 'name'],
                include: [
                  {
                    model: CountryModel,
                    attributes: ['id', 'name'],
                    as: 'country',
                    raw: true,
                    nest: true
                  }
                ],
                as: 'state',
                raw: true,
                nest: true
              }
            ],
            as: 'city',
            raw: true,
            nest: true
          }

        ],
        raw: true,
        nest: true
      });

      return res.send({ success: 1, data: location });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  update: async (req, res) => {
    try {
      let validator = new v(req.body, {
        id: "required",
        name: "required",
        address: "required",
        countryId: "required",
        stateId: "required",
        cityId: "required",
      });

      let matched = await validator.check();

      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: validatorError });
      }
      await LocationModel.update({
        name: req.body.name,
        country_id: req.body.countryId,
        state_id: req.body.stateId,
        city_id: req.body.cityId,
        updatedAt: Date.now(),
        address: req.body.address,
      }, {
        where: {
          id: req.body.id
        }
      });

      return res.status(200).send({ success: 1, message: "Updated Successfully." });

    } catch (error) {
      logger.error(req, error.message);
      console.log(error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  updateValidator: async (req, res) => {
    try {
      let updateValue = { customer_status: req.body?.customer_status }
      let query = { where: { id: req.params.id } }
      await LocationModel.update(updateValue, query);
      return res.send({ success: 1 });
    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  getAllLocations: async (req, res) => {
    try {
      let locations = await LocationModel.findAll({
        order: [["unique_name", "ASC"]],
        where: {
          is_customer: req.query.isCustomer,
        },
      });
      return res.status(200).send({ success: 1, data: locations });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  }
};

async function locationValidation(item) {
  try {
    let stateDetails = await StateModel.findOne({ where: { st_code: { [Op.iLike]: item.state }, country_id: 101 }, order: [['createdAt', 'DESC']], raw: true });
    if (!stateDetails) {
      return { success: 0, message: "State Doesn't Exists." };
    }
    let stateId = stateDetails?.id;

    let isCityExists = await CityModel.findOne({
      where: {
        name: item.city,
        state_id: stateId
      },
      attributes: ['id'],
      raw: true
    });
    if (!isCityExists) {
      let lastId = await CityModel.findOne({ attributes: ['id'], order: [['id', 'DESC']] });
      let obj = {
        id: Number(lastId.id) + 1,
        name: item.city,
        state_id: stateDetails.id,
        state_code: stateDetails?.iso2 ?? null,
        latitude: null,
        longitude: null,
        flag: 2,
        wikidataid: null,
        country_id: 101, // India
        country_code: 'IN',
        is_allocated: true
      }
      let city = await CityModel.create(obj);
      isCityExists = city;
    }

    return { success: 1, data: { stateDetails, isCityExists } };
  } catch (error) {
    console.log("error in table creation ", error.message);
    return { success: 0, message: "Internal Error" };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
module.exports = customer;
