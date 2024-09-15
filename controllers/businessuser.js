const v = require("node-input-validator");
const message = require("../i18n/en");
const uuid = require("uuid");
const randomstring = require("randomstring");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const bcrypt = require("bcryptjs");
const saltRounds = 10;

const { passwordStrength } = require("check-password-strength");
const CONSTANT = require("../config/const")

//models 
const models = require("./_models");

//controllers
const controller = require("./_controller");

models.CompanyUserModel.belongsTo(models.stateModel, {
  foreignKey: 'state_id'
});
models.stateModel.hasMany(models.CompanyUserModel, {
  foreignKey: 'state_id'
});

models.locationModel.hasOne(models.CompanyUserModel, {
  foreignKey: "location_id"
});
models.CompanyUserModel.belongsTo(models.locationModel, {
  foreignKey: "location_id"
});

const businessUserController = {
  add: async (req, res) => {
    try {
      let validatoryConfig = {
        role_id: "required",
        name: "required",
        phoneNo: "required",
        email: "required|email",
        password: "required",
      }

      if ([2].includes(Number(req.body.role_id))) {
        validatoryConfig.retailerOutletId = 'required'
      }

      let validator = new v(req.body, validatoryConfig);

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controller.parseValidate(validator.errors)
        return res.status(200).send({
          success: 0,
          message: validatorError
        });
      }
      let str = passwordStrength(req.body.password).value;
      if (str != "Strong") {
        return res.status(200).send({ success: 0, message: "Weak Password" });
      }

      const salt = await bcrypt.genSalt(saltRounds);
      const password = await bcrypt.hash(req.body.password, salt);

      let userWhereClause = {
        email: req.body.email,
        is_deleted: false
      }

      let emailVerificationToken = await controller.commonController.generateEmailVerificationToken(req.body.email);
      await controller.commonController.sendEmailVerificationMail(emailVerificationToken, req.body.email);
      let [user, userCreated] = await models.CompanyUserModel.findOrCreate({
        where: userWhereClause,
        attributes: ['id'],
        raw: true,
        defaults: {
          id: uuid(),
          random_id: randomstring.generate(15),
          role_id: req.body.role_id,
          name: req.body.name,
          mobile_no: req.body.phoneNo,
          email: req.body.email,
          password: password,
          is_email_verified: false,
          is_approved: true,
          is_deleted: false,
          retail_outlet_id: req.body.retailerOutletId,
          retailer_id: req.retailerId
        }
      });


      if (!userCreated) {
        return res.status(200).send({
          success: 0,
          message: message.businessUserExist
        });
      }

      // await sendEmailVerificationMail(emailVerificationToken, req.body.email);
      return res.status(200).send({
        success: 1,
        data: user,
        message: "User created successfully"
      });

    } catch (ex) {
      console.error(ex);
      controller.logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
  list: async (req, res) => {

    try {
      let whereClause = {
        is_deleted: false
      }
      whereClause.role_id = {
        [Op.gte]: req.roleId
      }
      if ([1, 2].includes(req.roleId)) {
        whereClause.retailer_id = req.retailerId;
      }
      console.log("req..........................", req.retailOutletId);
      if ([2].includes(req.roleId)) {
        whereClause.retail_outlet_id = req.retailOutletId;
      }
      let data = await models.CompanyUserModel.findAll({
        where: whereClause,
        include: [
          {
            model: models.companyRoleModel,
            attributes: ["name", "id"],
            required: true
          },
          {
            model: models.locationModel,
            raw: true,
            attributes: ['id', 'unique_name'],
          }
        ],
        order: [['role_id', 'ASC']],
        raw: true,
        nest: true
      })
      return res.status(200).send({ success: 1, data: data })

    } catch (error) {
      console.log(error);
      return res.status(500).send({ success: 0, message: "Some Internal Error" })
    }
  },
  delete: async function (req, res) {
    models.CompanyUserModel.update({
      is_deleted: true
    }, {
      where: {
        id: req.params.businessuserId
      }
    })
      .then(businessUser => {
        return res
          .status(200)
          .send({
            success: 0,
            message: message.businessUserDelete
          });
      })
      .catch(err => {
        controller.logger.error(req, err.message);
        return res.status(200).send({
          success: 0,
          message: err
        })
      });
  },
  detail: async (req, res) => {
    try {
      console.log("---------------------------------------------");
      let validator = new v(req.params, {
        id: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controller.parseValidate(validator.errors)
        return res.status(200).send({
          success: 0, message: validatorError
        });
      }


      let userDetails = await models.CompanyUserModel.findOne({
        where: {
          id: req.params.id
        }
      })

      if (!userDetails) {
        return res.status(200).send({ success: 0, message: "User details not found" })
      }
      return res.status(200).send({ success: 1, data: userDetails });

    } catch (err) {
      controller.logger.error(req, err.message);
      return res.status(200).send({
        success: 0,
        message: err.toString()
      })
    }
  },
  update: async (req, res) => {
    try {
      let validatoryConfig = {
        role_id: "required",
        name: "required",
        phoneNo: "required",
      };

      if ([3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 21].includes(Number(req.body.role_id))) {
        validatoryConfig.locationId = 'required'
      } else {
        req.body.locationId = null;
      }

      let validator = new v(req.body, validatoryConfig);

      let matched = await validator.check();
      if (!matched) {
        let validatorError = controller.parseValidate(validator.errors)
        return res
          .status(200)
          .send({
            success: 0,
            message: validatorError
          });
      }


      const userFound = await models.CompanyUserModel.findOne({
        where: {
          id: req.params.id
        }
      });

      if (!userFound) {
        return res.status(200).send({
          success: 0,
          message: 'User not found!'
        });
      }

      let ObjbusinessUser = {};

      ObjbusinessUser.role_id = req.body.role_id;
      ObjbusinessUser.name = req.body.name;
      ObjbusinessUser.location_id = req.body.locationId;

      if (req.body.password) {
        let str = passwordStrength(req.body.password).value;
        if (str != "Strong") {
          return res.status(200).send({ success: 0, message: "Weak Password" });
        }

        let newSR = CONSTANT.saltRound[Math.floor(Math.random() * CONSTANT.saltRound.length)];

        const salt = await bcrypt.genSalt(newSR);
        const password = await bcrypt.hash(req.body.password, salt);

        ObjbusinessUser.password = password;
        ObjbusinessUser.jwt_token = null;
      }

      const isUpdated = await models.CompanyUserModel.update(ObjbusinessUser, {
        where: {
          id: req.params.id
        }
      });

      if (isUpdated < 1) {
        return res
          .status(200)
          .send({
            success: 0,
            message: "User not updated"
          });
      }

      return res.status(200).send({
        success: 1,
        message: "User Updated Successfully"
      });
    } catch (ex) {
      controller.logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },
};

module.exports = businessUserController;
