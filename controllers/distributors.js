var uuid = require('uuid');
const { Sequelize, DataTypes } = require('sequelize');
const v = require('node-input-validator');
const parseValidate = require("../middleware/parseValidate");
const models = require("./_models");
const logger = require('../helpers/logger');
const Op = Sequelize.Op;

// controller
const controllers = require("./_controller");

let distributors = {

  search: async function (req, res) {
    try {
      let { search } = req.body;

      // Initialize an empty where clause
      let whereClause = {};

      // If a search term is provided, build the where clause to filter results
      if (search && search.length >= 3) {
        whereClause = {
          [Op.or]: [
            { name: { [Op.iLike]: `%${search}%` } },
            { gstin: { [Op.iLike]: `%${search}%` } },
            { phone: { [Op.iLike]: `%${search}%` } },
          ]
        };
      }
      let distributorSchema = await models.distributorSchema(req.tableUid);
      // Fetch distributors from the database based on the where clause
      let filteredDistributors = await distributorSchema.distributorModels.findAll({
        where: whereClause,
        order: [['updatedAt', 'DESC']],
        include: [
          {
            model: distributorSchema.retailDistributorModels,
            where: { retailer_id: req?.retailerId ?? null, retail_outlet_id: req?.retailOutletId ?? null },
            as: "retail_distributor",
            required: false,
            raw: true,
            nest: true
          }
        ],
        raw: true,
        nest: true
      });

      // If no distributors are found, return an appropriate message
      if (filteredDistributors.length == 0) {
        return res.status(200).send({ success: 0, message: "No distributors found matching your search criteria." });
      }

      // Return the filtered list of distributors
      return res.status(200).send({ success: 1, data: filteredDistributors });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: error.toString()
      });
    }
  },

  update: async function (req, res) {
    try {

      console.log("req.body>>>>>>>>>>>> ", req.body);
      let validator = new v(req.body, {
        distributor_name: "required|minLength:2|maxLength:255",
        license_no: "minLength:2|maxLength:60",
        gstin: "required|regex:^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$",
        phoneNumber: "required|minLength:10|maxLength:10",

        email: "email|maxLength:255",
        // countryId: "required",
        // stateId: "required",
        // cityId: "required",
        address: "required|minLength:2|maxLength:500",
        pincode: "required|minLength:6|maxLength:6",

      });
      console.log("validator>>>>>>>>>>>>>>>>> ", validator);
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: validatorError });
      }


      let distributorId = req.params.distributorId;


      // // Check for duplicate gstin
      // let gstinCount = await models.DistributorsModel.count({
      //   where: {
      //     gstin: req.body.gstin
      //   }
      // });
      // if (gstinCount > 0) {
      //   return res.status(200).send({ success: 0, message: 'gstin is already added!' });
      // }

      //For Pincode
      if (req.body.pincode.toString().length !== 6) {
        return res.status(400).send({ success: 0, message: 'Pincode should be 6 digits' });
      }



      // Validate gstin
      const gstinPattern = new RegExp("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$");
      if (!gstinPattern.test(req.body.gstin)) {
        return res.status(400).send({ success: 0, message: 'Please enter a valid gstin number' });
      }



      // Validate IFSC code
      if (req.body.ifsc) {
        const ifscPattern = new RegExp("^[A-Z]{4}0[A-Z0-9]{6}$");
        if (!ifscPattern.test(req.body.ifsc)) {
          return res.status(400).send({ success: 0, message: 'Please enter a valid IFSC code' });
        }
      }

      // Validate account number (assuming it should be between 9 and 18 digits)
      if (req.body.account_no) {
        const accountNumberPattern = new RegExp("^[0-9]{9,18}$");
        if (!accountNumberPattern.test(req.body.account_no)) {
          return res.status(400).send({ success: 0, message: 'Please enter a valid account number (9 to 18 digits)' });
        }
      }

      let city_name;
      if (req.body.cityId) {
        let cityDetails = await models.cityModel.findOne({ where: { id: req.body.cityId }, raw: true });
        city_name = cityDetails.name;
      }

      let state_name;
      if (req.body.stateId) {
        let stateDetails = await models.stateModel.findOne({ where: { id: req.body.stateId }, raw: true });
        state_name = stateDetails.name;
      }

      let country_name;
      if (req.body.countryId) {
        let countryDetails = await models.countriesModel.findOne({ where: { id: req.body.countryId }, raw: true });
        country_name = countryDetails.name;
      }

      let distributor = {

        name: req.body.distributor_name,

        lic_no: req.body.license_no,
        phone: req.body.phoneNumber,
        pincode: req.body.pincode,
        country_id: req.body.countryId,
        state_id: req.body.stateId,
        city_id: req.body.cityId,
        address: req.body.address,
        email: req.body.email,

        bank_name: req.body.bank_name,
        ifsc_code: req.body.ifsc,
        account_no: req.body.account_no,

        country_name: country_name,
        state_name: state_name,
        city_name: city_name
      }
      console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>distributor", distributor);

      const isUpdated = await models.DistributorsModel.update(distributor, {
        where: {
          id: distributorId,
        },
      });

      if (isUpdated < 1) {
        return res.status(200).send({ success: 0, message: "Distributor details hasn't updated. " });
      }

      return res.status(200).send({ success: 1, message: "Distributor details updated successfully." });


    } catch (ex) {
      console.error(ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },

  list: async function (req, res) {
    try {
      let whereClause = {
      }

      let allDistributors = await models.DistributorsModel.findAll({
        where: whereClause,
        order: [['updatedAt', 'DESC']],
        raw: true,
        nest: true
      });

      if (allDistributors.length == 0) {
        return res.status(200).send({ success: 0, message: "Distributors Details are currently unavailable. Please try again later." });
      }
      console.log(">>>>>>>> all Distributors", allDistributors);
      return res.status(200).send({ success: 1, data: allDistributors })
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  bulkAdd: async function (req, res) {
    try {

      let validator = new v(req.body, {
        distributors: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors)
        return res
          .status(200)
          .send({ success: "0", message: validatorError });
      }

      let rejectedArray = [];

      let allDistributors = JSON.parse(req.body.distributors);

      for (const item of allDistributors) {
        let itemValidator = new v(item, {
          name: "required",
          address: "required",
          pincode: "required",
          city: "required",
          state: "required",
          country: "required",
          lic_no: "required",
          gstin: "required",
        });

        let matched = await itemValidator.check();
        if (!matched) {
          let errors = parseValidate(itemValidator.errors);
          // rejectedArray.push({ ...item, reason: errors });
          return res.status(200).send({ success: "0", message: errors });
        }
      }

      let headerName = {
        "name": "name",
        "address": "address",
        "pincode": "pincode",
        "city": "city_name",
        "state": "state_name",
        "country": "country_name",
        "lic_no": "lic_no",
        "gstin": "GSTIN",
      };

      for (let element of allDistributors) {
        console.log(element);
        let ele = {};
        let idData = {};
        let keys = Object.keys(element);
        console.log(">>>> keys", keys);
        for (let key of keys) {
          ele[headerName[key]] = element[key] != null ? element[key].toString() : "";
        }
        console.log(">>>> ele", ele);

        let name = await models.DistributorsModel.findOne({
          where: {
            name: ele.name,
          }, raw: true
        });
        let gstin = await models.DistributorsModel.findOne({
          where: {
            gstin: ele.GSTIN,
          }, raw: true
        });
        let lic_no = await models.DistributorsModel.findOne({
          where: {
            lic_no: ele.lic_no,
          }, raw: true
        });
        let cityDetails = await models.cityModel.findOne({ where: { name: ele.city_name }, raw: true });
        if (cityDetails) {
          // ele.city = cityDetails.id;
          idData.city_id = cityDetails.id;
          console.log(">>>>>> city", cityDetails.id);
        } else {
          element.reason = "Please check entered City";
          rejectedArray.push(element);
        }
        let stateDetails = await models.stateModel.findOne({ where: { name: ele.state_name }, raw: true });
        if (stateDetails) {
          idData.state_id = stateDetails.id;
          // ele.state = stateDetails.id;
        } else {
          element.reason = "Please check entered State";
          rejectedArray.push(element);
        }
        let countryDetails = await models.countriesModel.findOne({ where: { name: ele.country_name }, raw: true });
        if (countryDetails) {
          idData.country_id = countryDetails.id;
          // ele.country = countryDetails.id;
        } else {
          element.reason = "Please check entered Country";
          rejectedArray.push(element);
        }
        if (name) {
          element.reason = "Name already exists";
          rejectedArray.push(element);
        } else if (gstin) {
          element.reason = "gstin already exists";
          rejectedArray.push(element);
        } else if (lic_no) {
          element.reason = "Licence No already exists";
          rejectedArray.push(element);
        } else {
          let response = await add(ele, idData, req);
          if (response.success == 0) {
            element.reason = response.message;
            rejectedArray.push(element);
          }
        }
      }
      if (rejectedArray.length > 0) {
        if (rejectedArray.length == allDistributors.length) {
          return res.status(200).send({ success: "0", message: `All materials are rejected due to some reasons`, data: rejectedArray });
        } else {
          return res.status(200).send({ success: "0", message: `${allProducts.length - rejectedArray.length} ${allProducts.length - rejectedArray.length > 1 ? 'Materials are' : 'Material is'}  added and ${rejectedArray.length} rejected due to some error.`, data: rejectedArray });
        }
      } else {
        return res.status(200).send({ success: "1", message: "Distributors are added successfully" });
      }
    }
    catch (error) {
      console.log("error", error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: "Internal Server Error" });
    }
  },
  add_distributor: async function (req, res) {
    try {
      let validator = new v(req.body, {
        distributor_name: "required|minLength:2|maxLength:255",
        license_no: "minLength:2|maxLength:60",
        gstin: "required|regex:^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$",
        phoneNumber: "required|minLength:10|maxLength:10",
        email: "email|maxLength:255",
        // countryId: "",
        // stateId: "",
        // cityId: "",
        address: "required|minLength:2|maxLength:255",
        pincode: "required|minLength:6|maxLength:6",

      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: validatorError });
      }

      // Check for duplicate gstin
      let gstinCount = await models.DistributorsModel.count({
        where: {
          gstin: req.body.gstin
        }
      });
      if (gstinCount > 0) {
        return res.status(200).send({ success: 0, message: 'Gstin is already added!' });
      }

      //For Pincode
      if (req.body.pincode.length !== 6) {
        return res.status(400).send({ success: 0, message: 'Pincode should be 6 digits' });
      }

      // Validate gstin
      const gstinPattern = new RegExp("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$");
      if (!gstinPattern.test(req.body.gstin)) {
        return res.status(400).send({ success: 0, message: 'Please enter a valid Gstin Number' });
      }

      // Validate IFSC code
      if (req.body.ifsc) {
        const ifscPattern = new RegExp("^[A-Z]{4}0[A-Z0-9]{6}$");
        if (!ifscPattern.test(req.body.ifsc)) {
          return res.status(400).send({ success: 0, message: 'Please enter a valid IFSC code' });
        }
      }

      // Validate account number (assuming it should be between 9 and 18 digits)
      if (req.body.account_no) {
        const accountNumberPattern = new RegExp("^[0-9]{9,18}$");
        if (!accountNumberPattern.test(req.body.account_no)) {
          return res.status(400).send({ success: 0, message: 'Please enter a valid account number (9 to 18 digits)' });
        }
      }

      let city_name;
      if (req.body.cityId) {
        let cityDetails = await models.cityModel.findOne({ where: { id: req.body.cityId }, raw: true });
        city_name = cityDetails.name;
      }

      let state_name;
      if (req.body.stateId) {
        let stateDetails = await models.stateModel.findOne({ where: { id: req.body.stateId }, raw: true });
        state_name = stateDetails.name;
      }

      let country_name;
      if (req.body.countryId) {
        let countryDetails = await models.countriesModel.findOne({ where: { id: req.body.countryId }, raw: true });
        country_name = countryDetails.name;
      }

      let distributorId = uuid();
      let distributor = {
        id: distributorId,
        name: req.body.distributor_name,
        gstin: req.body.gstin,
        lic_no: req.body.license_no,
        phone: req.body.phoneNumber,
        pincode: req.body.pincode,
        country_id: req.body.countryId,
        state_id: req.body.stateId,
        city_id: req.body.cityId,
        address: req.body.address,
        email: req.body.email,

        bank_name: req.body.bank_name,
        ifsc_code: req.body.ifsc,
        account_no: req.body.account_no,

        country_name: country_name,
        state_name: state_name,
        city_name: city_name
      }
      console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>distributor", distributor);
      await models.DistributorsModel.create(distributor);

      res.status(200).send({ success: 1, message: "Distributor added!" });
    } catch (error) {
      console.log(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: error.message
      });
    }
  }
}
async function add(data, idData, req) {
  try {
    let validate = {
      name: "required",
      address: "required",
      pincode: "required",
      city_name: "required",
      state_name: "required",
      country_name: "required",
      lic_no: "required",
      gstin: "required",
    };

    let validator = new v(data, validate);


    let matched = await validator.check();
    if (!matched) {
      let validatorError = await parseValidate(validator.errors)
      return { success: 0, message: validatorError };
    }

    let distributorId = uuid();

    //For Pincode
    if (!data.pincode == 6) {
      return { success: 0, message: "Pincode should be in 6 digit" };
    }

    //For gstin
    const gstinPattern = new RegExp("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$");

    if (!gstinPattern.test(data.gstin)) {
      return { success: 0, message: "Please enter valid gstin number" };
    }

    await models.DistributorsModel.create({
      id: distributorId,
      name: data.name,
      address: data.address,
      pincode: data.pincode,
      city_name: data.city_name,
      state_name: data.state_name,
      country_name: data.country_name,
      lic_no: data.lic_no,
      gstin: data.gstin,
      city_id: idData.city_id,
      state_id: idData.state_id,
      country_id: idData.country_id,
    });

    return {
      success: 1,
      message: "Distributors added successfully."
    };
  } catch (ex) {
    console.error(ex);
    controllers.logger.error(req, error.message);
    return {
      success: 0,
      message: ex.message
    };
  }
};


module.exports = distributors