const uuid = require("uuid");
const v = require("node-input-validator");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

const msg = require("../../i18n/businessen");
let parseValidate = require("../../middleware/parseValidate");

const businessUser = require("../../models").company_users;
const businessRole = require("../../models").company_roles;

const RegionModel = require("../../models").regions;
const ChannelModel = require("../../models").channels;
const CompanyRole = require("../../models").company_roles;
const CompanyUser = require("../../models").company_users;

CompanyRole.hasMany(CompanyUser, { foreignKey: "role_id" });
CompanyUser.belongsTo(CompanyRole, { foreignKey: "role_id" });

const logger = require('../../helpers/logger');

const usercontroller = {
  userType: function (req, res) {
    if (req.headers["x-key"] == "") {
      res.status(200).send({ success: "0", message: msg.customerIdrequired });
    } else {
      CompanyUser
        .findOne({
          attributes: ["company_id", "role_id"],
          where: {
            id: req.headers["x-key"],
          },
        })
        .then((UserInfo) => {
          businessRole
            .findAll({
              attributes: ["id", "name"],
              where: {
                company_id: UserInfo.company_id,
                businessrole_parent_id: UserInfo.role_id,
              },
            })
            .then((RoleType) => {
              if (RoleType) {
                return res.status(200).send({ success: "1", data: RoleType });
              } else {
                return res
                  .status(200)
                  .send({ success: "0", message: msg.noroletype });
              }
            })
            .catch((err) => {
              logger.error(req, err.message);
              return res.status(500).send({ success: "0", message: err });
            });
        });
    }
  },

  parentUserType: function (req, res) {
    if (req.headers["x-key"] == "") {
      res.status(200).send({ success: "0", message: msg.customerIdrequired });
    } else {
      CompanyUser
        .findOne({
          attributes: ["company_id", "role_id"],
          include: {
            model: businessRole,
          },
          where: {
            id: req.headers["x-key"],
          },
        })
        .then((UserInfo) => {
          if (UserInfo.business_role.businessrole_parent_id != 0) {
            businessRole
              .findAll({
                attributes: ["id", "name"],
                where: {
                  company_id: UserInfo.company_id,
                  id: UserInfo.business_role.businessrole_parent_id,
                },
              })
              .then((RoleType) => {
                if (RoleType) {
                  return res.status(200).send({ success: "1", data: RoleType });
                } else {
                  return res
                    .status(200)
                    .send({ success: "0", message: msg.noroletype });
                }
              })
              .catch((err) => {
                logger.error(req, err.message);
                return res.status(500).send({ success: "0", message: err });
              });
          } else {
            return res
              .status(200)
              .send({ success: "0", message: msg.noaccess });
          }
        });
    }
  },

  userList: function (req, res) {
    if (req.params.roleId == "") {
      res.status(200).send({ success: "0", message: msg.roleIdrequired });
    } else {
      CompanyUser
        .findAll({
          attributes: [
            "id",
            "company_id",
            "name",
            "last_name",
            "mobile_no",
            "email",
          ],
          where: {
            role_id: req.params.roleId,
            is_deleted: false,
            id: { [Op.ne]: req.headers["x-key"] },
          },
        })
        .then((userList) => {
          if (userList.length > 0) {
            return res.status(200).send({ success: "1", data: userList });
          } else {
            return res
              .status(200)
              .send({ success: "0", message: msg.noUserList });
          }
        })
        .catch((err) => {
          logger.error(req, err.message);
          return res.status(500).send({ success: "0", message: err });
        });
    }
  },
  getUserNameList: async (req, res) => {
    CompanyRole.findAll({
      where: {
        name: {
          [Op.in]: ["Admin", "CFA", "Factory"],
        },
      },
      attributes: ["id"],
      raw: true,
    })
      .then((response) => {
        if (response.length == 0) {
          return res.send({ success: 0, message: "Parties not found!" });
        }

        let ids = response.map((item) => {
          return item.id;
        });

        CompanyUser.findAll({
          where: {
            is_deleted: false,
            user_name: {
              [Op.not]: null,
            },
            role_id: {
              [Op.notIn]: ids,
            },
          },
          attributes: ["id", ["user_name", "username"]],
          raw: true,
        })
          .then((userList) => {
            return res.send({ success: 1, data: userList });
          })
          .catch((err) => {
            logger.error(req, err.message);
            return res.status(500).send({ success: 0, reason: err });
          });
      })
      .catch((err) => {
        logger.error(req, err.message);
        return res.status(500).send({ success: 0, reason: err });
      });
  },
  getChannelList: async function (req, res) {
    let where;
    console.log(req.roleId, ">>>>>.userId")
    if (req.roleId == 1) {
      where = { id: { [Op.gte]: 1 } }
    } else if (req.roleId == 2) {
      where = { id: { [Op.gte]: 2 } }
    } else {
      where = { id: { [Op.gt]: 2 } }
    }
    CompanyRole.findAll({
      attributes: ["id", "name"],
      where: where,
      raw: true,
    })
      .then((channelList) => {
        return res.send({ success: "1", data: channelList });
      })
      .catch((err) => {
        logger.error(req, err.message);
        return res.send({ success: "0", reason: err });
      });
  },
  getRegionsList: async (req, res) => {
    RegionModel.findAll({
      attributes: ["id", "name"],
      where: { is_deleted: false },
      raw: true,
    })
      .then((regionList) => {
        return res.send({ success: "1", data: regionList });
      })
      .catch((err) => {
        logger.error(req, err.message);
        return res.send({ success: "0", reason: err });
      });
  },
};

module.exports = usercontroller;
