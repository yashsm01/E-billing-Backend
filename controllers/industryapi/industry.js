
const industryModel = require("../../models").companies;
var uuid = require('uuid');
const { Sequelize, DataTypes } = require('sequelize');
const v = require('node-input-validator');
const parseValidate = require("../../middleware/parseValidate");
const { message } = require("../_models");
const { response } = require("express");





let industry = {

  // addCompany: async (req, res) => {

  //   console.log(req.body, "reqqqqqqqqqqqqqqqqqqqqqq")
  //   try {

  //     if (!req.body) {
  //       return res.status(200).send({
  //         "success": "0",
  //         "message": validator.errors
  //       })
  //     }

  //     for (const item of req.body.array) {
  //       await industryModel.create({
  //         id: uuid.v4(),
  //         name: item.name,
  //       });
  //     }

  //     return res.status(200).send({
  //       success: 1,
  //       message: "Compnay added successfully",
  //     });
  //   }
  //   catch (err) {
  //     console.log("Err", err);
  //     return res.status(500).send({ success: 0, message: err.message })
  //   }
  // },

  addCompany: async (req, res) => {
    try {

      if (!req.body) {
        return res
          .send({ success: "0", message: "Please select file" });


      }

      let validator = new v(req.body, {
        company: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors)
        return res
          .status(200)
          .send({ success: "0", message: validatorError });
      }



      console.log(req.body, "req.body")
      let rejectedArray = [];
      let companyData = JSON.parse(req.body.company)

      // if name feild is not exist in req.body then return with error
      for (const item of companyData) {
        let validator = new v(item, {
          name: "required",
        });
        let matched = await validator.check();
        if (!matched) {
          rejectedArray.push({ ...item, reason: "Name is required" });
        }
      }


      let headerName = {
        "name": "name",
      };
      for (let element of companyData) {
        console.log(element);
        let ele = {};
        let keys = Object.keys(element);
        console.log(keys, "keysssssss")
        for (let key of keys) {
          ele[headerName[key]] = element[key] != null ? element[key].toString() : "";
        }

        let compnayDetails = await industryModel.findOne({ where: { name: ele.name }, raw: true });

        if (!compnayDetails) {
          await industryModel.create({
            id: uuid.v4(),
            name: element.name,
          });
        }

        else {
          element.reason = "Company name is allready exist";
          rejectedArray.push(element);

        }
      }
      if (rejectedArray.length > 0) {
        if (rejectedArray.length == companyData.length) {
          return res.status(200).send({ success: "0", message: `All materials are rejected due to some reasons`, data: rejectedArray });
        } else {
          return res.status(200).send({ success: "0", message: ` rejected due to some error.`, data: rejectedArray });
        }
      } else {
        return res.status(200).send({ success: "1", message: "Company added successfully" });
      }
    }
    catch (error) {
      console.log("error", error);
      return res.status(500).send({ success: 0, message: "Internal Server Error" });
    }
  },





  getCompanyList: async (req, res) => {

    try {



      const getListOfCompany = await industryModel.findAll()

      console.log(getListOfCompany, "..............listttt")

      return res.status(200).send({
        success: 1,
        message: "success",
        data: getListOfCompany
      });
    }
    catch (err) {
      console.log("Err", err);
      return res.status(500).send({ success: 0, message: err.message })
    }
  },

}



module.exports = industry