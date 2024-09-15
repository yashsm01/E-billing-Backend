const v = require("node-input-validator");
const Sequelize = require("sequelize");
const Op = Sequelize.Op
const uuid = require("uuid");
const logger = require("../helpers/logger");
const LocationModel = require("../models/").locations;
const CityModel = require('../models/').city;
const StateModel = require('../models/').state;
const CountryModel = require('../models/').countries;
const LocationRole = require("../models/").company_roles;
const storageBins = require("../models/").storage_bins;
const companiesModel = require("../models/").companies
const path = require("path");
const models = require("./_models");
const { Client } = require("pg");
const parseValidate = require('./../middleware/parseValidate')
const moment = require('moment');



const location = {
  // add: async (req, res) => {
  //   try {
  //     let validate = {
  //       uniqueName: "required",
  //       name: "required",
  //       address: "required",
  //       cityId: "required",
  //     };
  //     if (req.body.isZrtBased == true) {
  //       validate.zoneId = "required";
  //       validate.regionId = "required";
  //     }
  //     let validator = new v(req.body, validate);
  //     req.body.uniqueName = req.body.uniqueName.toUpperCase();
  //     req.body.name = req.body.name.toUpperCase();
  //     let matched = await validator.check();
  //     if (!matched) {
  //       let validatorError = parseValidate(validator.errors);
  //       return res.status(200).send({ success: "0", message: validatorError });
  //     }

  //     // search for history ids
  //     let zoneHistoryId;
  //     let regionHistoryId;
  //     let territoryHistoryId;
  //     if (req.body.isZrtBased == true) {
  //       zoneHistoryId = await models.parentZoneMasterModel.findOne({
  //         where: {
  //           id: req.body.zoneId
  //         }
  //       });
  //       regionHistoryId = await models.zoneMasterModel.findOne({
  //         where: {
  //           id: req.body.regionId
  //         }
  //       });

  //       territoryHistoryId = await models.territoryMasterModel.findOne({
  //         where: {
  //           id: req.body.territory_id
  //         }
  //       });
  //     }

  //     let count = await LocationModel.count({
  //       where: {
  //         unique_name: req.body.uniqueName,
  //         is_deleted: false
  //       }
  //     });
  //     if (count > 0) {
  //       return res.status(200).send({ success: 0, message: "Location is already added!" });
  //     }

  //     let lastLocation = await LocationModel.findOne({
  //       where: {},
  //       attributes: ['code'],
  //       order: [
  //         ["createdAt", "DESC"]
  //       ],
  //       raw: true
  //     });

  //     let locationCode = await getNextCode(lastLocation?.code);
  //     if (!locationCode) {
  //       return res.status(200).send({ success: 0, message: "Location Code Not Generated" })
  //     }
  //     let loactionId = uuid();
  //     await LocationModel.create({
  //       id: loactionId,
  //       unique_name: req.body.uniqueName,
  //       name: req.body.name,
  //       phone_no: req.body.phoneNo,
  //       address: req.body.address,
  //       city_id: req.body.cityId,
  //       code: locationCode,
  //       licence_no: req.body.licenceNo,
  //       zone_id: zoneHistoryId?.zone_history_id ?? null,
  //       region_id: regionHistoryId?.zone_history_id ?? null,
  //       territory_id: territoryHistoryId?.terriotory_history_id ?? null,
  //       tenant_id: req.body?.tenantId ?? null,
  //       api_key: req.body?.apiKey ?? null,
  //       transfer_validator: true,
  //       sales_validator: true,
  //       return_validator: true
  //     });

  //     //add intransit bin while adding a location
  //     await storageBins.create({
  //       name: "In Transit",
  //       location_id: loactionId,
  //     });
  //     await storageBins.create({
  //       name: "OK",
  //       location_id: loactionId,
  //       is_default_bin: true
  //     });
  //     await storageBins.create({
  //       name: "Damage",
  //       location_id: loactionId,
  //     });
  //     await storageBins.create({
  //       name: "Missing",
  //       location_id: loactionId,
  //     });

  //     return res.send({ success: 1, message: "Location Added Successfully!" });
  //   }
  //   catch (error) {
  //     console.log(error);
  //     logger.error(req, error.message);
  //     console.log("error", error.message);
  //     return res.status(500).send({ message: error.toString() });
  //   }
  // },




  add: async (req, res) => {
    try {
      console.log(req.body, "req.body")



      let validator = new v(req.body, {
        locations: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors)
        return res
          .status(200)
          .send({ success: "0", message: validatorError });
      }



      let rejectedArray = [];
      let allLocations = JSON.parse(req.body.locations)
      console.log(allLocations, "all locationsssssssssssss")

      // if name feild is not exist in req.body then return with error
      for (const item of allLocations) {
        let itemValidator = new v(item, {
          company_name: "required",
          location_name: "required",
          unique_name: "required",
          address: "required"
        });

        let matched = await itemValidator.check();
        if (!matched) {
          let errors = parseValidate(itemValidator.errors);
          console.log(errors, "eroeeeeeeeeeeeeee")
          return res.status(200).send({ success: "0", message: errors });
        }
      }
      let headerName = {
        "company_name": "company_id",
        "location_name": "location_name",
        "unique_name": "unique_name",
        "address": "address",
        "city": "city_id",
        "state": "state_id",
        "country": "country_id",
      };
      for (let element of allLocations) {
        console.log(element, "................................");
        let ele = {};
        let keys = Object.keys(element);
        console.log(keys, "keysssssss")
        for (let key of keys) {
          ele[headerName[key]] = element[key] != null ? element[key].toString() : "";
        }
        console.log(ele, "eleeeeeeeeeee")

        let unique_name = await LocationModel.findOne({
          where: {
            unique_name: ele.unique_name,
          },
        });
        let companyDetails = await companiesModel.findOne({ where: { name: ele.company_id } });
        if (companyDetails) {
          ele.companyId = companyDetails.id;
        }
        else {
          element.reason = "Please check company name fields";
          rejectedArray.push(element);
        }

        let countryDetails = await CountryModel.findOne({ where: { name: ele.country_id } });
        if (countryDetails) {
          ele.countryId = countryDetails.id;
        }
        else {
          element.reason = "Please check country fields";
          rejectedArray.push(element);
        }
        let stateDetails = await StateModel.findOne({ where: { name: ele.state_id, country_id: ele.countryId } });
        if (stateDetails) {
          ele.stateId = stateDetails.id;
        }
        else {
          element.reason = "Please check state fields";
          rejectedArray.push(element);

        }
        let cityDetails = await CityModel.findOne({ where: { name: ele.city_id, state_id: ele.stateId, country_id: ele.countryId } });
        if (cityDetails) {
          ele.cityId = cityDetails.id;
        }
        else {
          element.reason = "Please check city fields";
          rejectedArray.push(element);

        }

        if (unique_name) {
          element.reason = "unique name already exists";
          rejectedArray.push(element);

        } else {

          let response = await LocationModel.create({
            id: uuid.v4(),
            name: ele.location_name,
            unique_name: ele.unique_name,
            address: ele.address,
            city_id: ele.cityId,
            state_id: ele.stateId,
            country_id: ele.countryId,
            company_id: ele.companyId,

          });
          if (response.success == 0) {
            element.reason = response.message;
            rejectedArray.push(element);
          }
        }
      }
      if (rejectedArray.length > 0) {
        if (rejectedArray.length == allLocations.length) {
          return res.status(200).send({ success: "0", message: `All materials are rejected due to some reasons`, data: rejectedArray });
        } else {
          return res.status(200).send({ success: "0", message: ` rejected due to some error.`, data: rejectedArray });
        }
      } else {
        return res.status(200).send({ success: "1", message: "Location added successfully" });
      }
    }
    catch (error) {
      console.log("error", error);
      return res.status(500).send({ success: 0, message: "Internal Server Error" });
    }
  },

  getLocations: async (req, res) => {
    try {
      let whereClause;
      let dateFilter = [];
      if (req.query.startDate) {
        dateFilter.push({ createdAt: { [Op.gte]: moment(req.query.startDate).format("YYYY-MM-DD") + " 00:00:00" } });
      }
      if (req.query.endDate) {
        dateFilter.push({ createdAt: { [Op.lte]: moment(req.query.endDate).format("YYYY-MM-DD") + " 23:59:59" } });
      }
      if (dateFilter.length > 0) {
        whereClause = dateFilter;
      }
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
              },
            ],
            as: 'city',
            raw: true,
            nest: true
          },
          {
            model: companiesModel,
            attributes: ['id', 'name'],
            as: 'company',
            raw: true,
            nest: true

          }
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
                    as: 'country'
                  },
                ],
                as: 'state',
                raw: true,
                nest: true
              },
            ],
            as: 'city',
            raw: true,
            nest: true
          },
          {
            model: companiesModel,
            attributes: ['id', 'name'],
            as: 'company',
            raw: true,
            nest: true

          }

        ],

      });
      console.log("location", location)
      return res.send({ success: 1, data: location });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  update: async (req, res) => {
    try {

      console.log(req.body, "bodyyyyyyyyyyyyyyyyyyyy")
      let validator = new v(req.body, {
        id: "required",
        // phoneNo: "required",
        address: "required",
        locationName: "required",
        companyName: "required",
      });
      // req.body.name = req.body.name.toUpperCase();
      let matched = await validator.check();

      if (!matched) {
        let validatorError = parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: validatorError });
      }

      let allData = req.body
      let companyId
      // search for history ids
      // let zoneHistoryId;
      // let regionHistoryId;
      // let territoryHistoryId;
      // if (req.body.isZrtBased == true) {
      //   zoneHistoryId = await models.parentZoneMasterModel.findOne({
      //     where: {
      //       id: req.body.zoneId
      //     }
      //   });
      //   regionHistoryId = await models.zoneMasterModel.findOne({
      //     where: {
      //       id: req.body.regionId
      //     }
      //   });

      //   territoryHistoryId = await models.territoryMasterModel.findOne({
      //     where: {
      //       id: req.body.territory_id
      //     }
      //   });
      // }


      // search for city,state and country

      let companyDetails = await companiesModel.findOne({ where: { name: allData.companyName } });
      if (companyDetails) {
        companyId = companyDetails.id;
      }
      else {
        return res.status(400).send({ success: 0, message: "Company is not exist." });

      }


      if (allData.city && allData.state && allData.country) {
        let countryId
        let stateId

        let countryDetails = await CountryModel.findOne({ where: { name: allData.country } });
        if (countryDetails) {
          countryId = countryDetails.id;
        }
        else {
          return res.status(400).send({ success: 0, message: "Country name is not valid." });
        }
        let stateDetails = await StateModel.findOne({ where: { name: allData.state, country_id: countryId } });
        if (stateDetails) {
          stateId = stateDetails.id;
        }
        else {
          return res.status(400).send({ success: 0, message: "state name is not valid." });

        }
        let cityDetails = await CityModel.findOne({ where: { name: allData.city, state_id: stateId, country_id: countryId } });
        if (cityDetails) {
          cityId = cityDetails.id;
        }
        else {
          return res.status(400).send({ success: 0, message: "city name id not valid." });

        }

        try {
          await LocationModel.update({
            city_id: cityId,
            state_id: stateId,
            country_id: countryId,
            name: allData.locationName,
            company_Id: companyId,
            address: allData.address,
            updatedAt: Date.now(),
          }, {
            where: {
              id: req.body.id
            }
          });

          return res.status(200).send({ success: 1, message: "Location updated Successfully1." });



        } catch (error) {
          console.log(error.message);
          return res.status(500).send({ message: error.toString() });

        }

      } else if (!allData.city && !allData.state && !allData.country) {
        try {
          await LocationModel.update({
            name: allData.locationName,
            company_Id: companyId,
            address: allData.address,
            updatedAt: Date.now(),

          }, {
            where: {
              id: req.body.id
            }
          });

          return res.status(200).send({ success: 1, message: "Location updated Successfully2." });




        } catch (error) {
          return res.status(500).send({ message: error.toString() });
        }

      }
    } catch (error) {
      logger.error(req, error.message);
      console.log(error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },


  //Currentelly not in use............................................

  updateValidator: async (req, res) => {
    try {
      let updateValue = { allow_sync: req.body?.allow_sync, transfer_validator: req.body?.transfer_validator, sales_validator: req.body?.sales_validator, return_validator: req.body?.return_validator }
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
  },
  getlocationDetailsById: async (req, res) => {
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
            attributes: ['id', 'name', 'district_id', 'taluks_id'],
            include: [
              {
                model: StateModel,
                attributes: ['id', 'name'],
                include: [
                  {
                    model: CountryModel,
                    attributes: ['id', 'name'],
                    as: 'country'
                  },
                ],
                as: 'state',
                raw: true,
                nest: true
              },
            ],
            as: 'city',
            raw: true,
            nest: true
          }, {
            model: models.parentZoneHistoryMasterModels,
            attributes: ["name", "zone_id"],
          }, {
            model: models.zoneHistoryMasterModels,
            attributes: ["name", "zone_id"],
          }, {
            model: models.territoryHistoryMasterModel,
            attributes: ["name", "territory_id"]
          }
        ],

      });
      console.log("location", location)
      return res.send({ success: 1, data: location });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },

};
async function createSummaryTable(tableName, partitionExp) {
  try {
    const env = process.env.APP_ENV || "development";

    let config = null;

    if (env == "development") config = require(path.resolve(global.rootPath + "/config/config.json"))[env];
    else config = require(path.resolve(global.rootPath + "/config/prod-config.json"))[env];

    const client = new Client({
      user: config.username,
      host: config.host,
      database: config.database,
      password: config.password,
      port: 5432,
    });
    await client.connect();

    let query = `CREATE TABLE public.${tableName} PARTITION OF public.stock_summary FOR VALUES IN('${partitionExp}')`;
    console.log("Query: ", query);
    await client.query(query);

    await client.end();

    console.log("New Summary Table Has Created");
  } catch (error) {
    console.log("error in table creation ", error.message);
  }
}

function getNextCode(currentCode) {
  const characters = "ACDEFGHJKLMNPRSTUVWXYZ23456789";
  const codeLength = 1; // Generate single-digit codes

  if (!currentCode) return characters.charAt(0);

  const currentIndex = characters.indexOf(currentCode);
  if (currentIndex === characters.length - 1) {
    // Reached the last character, return Nothing
    return false
  } else {
    // Return the next character in the sequence
    return characters.charAt(currentIndex + 1);
  }
}

async function locationValidation(item) {
  try {
    let stateDetails = await StateModel.findOne({ where: { st_code: { [Op.iLike]: item.state }, country_id: 101 }, order: [['createdAt', 'DESC']], raw: true });
    if (!stateDetails) {
      return { success: 0, message: "State Doesn't Exists." };
    }
    let stateId = stateDetails?.id;
    let countryId = stateDetails?.country_id;

    // return { success: 1, data: { stateDetails } };

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
      // return { success: 0, message: "City Doesn't Exists." };
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

module.exports = location;
