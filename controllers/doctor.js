const v = require("node-input-validator");
const uuid = require("uuid");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const db = require('../models');

// models
let models = require("./_models");

// controller
const controllers = require("./_controller");

const doctor = {

  search: async function (req, res) {
    try {
      let { search } = req.body;

      // Initialize an empty where clause
      let whereClause = {};

      // If a search term is provided, build the where clause to filter results

      // if (search && search.length >= 3) {
      if (search) {
        whereClause = {
          [Op.or]: [
            // Split by space and search for a first name + last name combination
            Sequelize.where(
              Sequelize.fn('concat', Sequelize.col('first_name'), ' ', Sequelize.col('last_name')),
              {
                [Op.iLike]: `%${search}%`
              }
            ),
            // Search individually in first_name, last_name, or phone
            { first_name: { [Op.iLike]: `%${search}%` } },
            { last_name: { [Op.iLike]: `%${search}%` } },
            { phone: { [Op.iLike]: `%${search}%` } },
          ]
        };
      }

      // Fetch doctors from the database based on the where clause
      let filteredDoctors = await models.doctorsModel.findAll({
        where: whereClause,
        order: [['updatedAt', 'DESC']],
        limit: search && search.trim().length >= 3 ? null : 3, // If no search term, limit to last 3 updated records
        raw: true,
        nest: true
      });

      // If no doctors are found, return an appropriate message
      if (filteredDoctors.length == 0) {
        return res.status(200).send({ success: 0, message: "No doctors found matching your search criteria." });
      }

      // Return the filtered list of doctors
      return res.status(200).send({ success: 1, data: filteredDoctors });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: error.toString()
      });
    }
  },


  list: async function (req, res) {
    try {
      let whereClause = {
      }

      let allDoctors = await models.doctorsModel.findAll({
        where: whereClause,
        order: [['updatedAt', 'DESC']],
        raw: true,
        nest: true
      });
      if (allDoctors.length == 0) {
        return res.status(200).send({ success: 0, message: "Doctors Details are currently unavailable. Please try again later." });
      }
      // console.log(">>>>>>>> all Doctors", allDoctors);
      return res.status(200).send({ success: 1, data: allDoctors })
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  addDoctor: async (req, res) => {
    try {
      let validator = new v(req.body, {
        firstName: "required|minLength:2|maxLength:40",
        lastName: "minLength:2|maxLength:40",
        phoneNumber: "required|minLength:10|maxLength:10",
        // countryId: "required",
        // stateId: "required",
        // cityId: "required",
        // address: "minLength:10|maxLength:500",
        pincode: "minLength:6|maxLength:6",
        license_no: "minLength:2|maxLength:60",
      });

      console.log(">>>>>>>>>>>>>>>>>req.body", req.body);
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: "0", message: validatorError });
      }

      let doctorDetails = await models.doctorsModel.findOne({
        where: {
          phone: req.body.phoneNumber
        }
      });
      console.log(">>>>>>>>>>>>>>>>>>>>>>>req.body: ", req.body);
      if (doctorDetails) {
        return res.status(200).send({ success: 0, message: "doctor is already added(with SAME Phone Number)!" });
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


      let doctor_id = uuid();
      let doctor = {
        id: doctor_id,
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        phone: req.body.phoneNumber,
        // email: req.body.email,
        pincode: req.body.pincode,
        country_code: req.body?.countryId ?? null,
        state_id: req.body?.stateId ?? null,
        city_id: req.body?.cityId ?? null,
        address: req.body.address,
        license_No: req.body.license_no,
        is_contact_verified: req.body.is_contact_verified ? req.body.is_contact_verified : true,
        is_email_verified: req.body.is_email_verified ? req.body.is_email_verified : true,
        country_name: country_name,
        state_name: state_name,
        city_name: city_name
      }
      // console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>doctor", doctor);
      await models.doctorsModel.create(doctor);

      res.status(200).send({ success: 1, message: "Doctor added!" });
    } catch (ex) {
      console.log(ex);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },

  update: async (req, res) => {
    try {
      let validator = new v(req.body, {
        firstName: "required|minLength:2|maxLength:40",
        lastName: "minLength:2|maxLength:40",
        phoneNumber: "required|minLength:10|maxLength:10",
        // countryId: "required",
        // stateId: "required",
        // cityId: "required",
        address: "minLength:10|maxLength:500",
        pincode: "minLength:6|maxLength:6",
        license_no: "minLength:2|maxLength:60",
      });

      let matched = await validator.check();
      if (!matched) {
        return res
          .status(200)
          .send({
            success: 0,
            message: validator.errors
          });
      }

      let doctorId = req.params.doctorId;


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

      let updateDoctor = {
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        phone: req.body.phoneNumber,
        // email: req.body.email,
        pincode: req.body.pincode,
        country_code: req.body?.countryId ?? null,
        state_id: req.body?.stateId ?? null,
        city_id: req.body?.cityId ?? null,
        address: req.body.address,
        license_No: req.body.license_no,
        is_contact_verified: req.body.is_contact_verified ? req.body.is_contact_verified : true,
        is_email_verified: req.body.is_email_verified ? req.body.is_email_verified : true,
        country_name: country_name,
        state_name: state_name,
        city_name: city_name
      }

      console.log('updateDoctor>>>>>>>', updateDoctor);
      const isUpdated = await models.doctorsModel.update(updateDoctor, {
        where: {
          id: doctorId,
        },
      });

      if (isUpdated < 1) {
        return res.status(200).send({ success: 0, message: "Doctor details hasn't updated. " });
      }

      return res.status(200).send({ success: 1, message: "Doctor details updated successfully." });
    } catch (ex) {
      console.error(ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
};

module.exports = doctor;
