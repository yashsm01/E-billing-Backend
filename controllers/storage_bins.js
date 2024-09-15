const v = require('node-input-validator');
const Sequelize = require('sequelize');
const logger = require('../helpers/logger');
const StorageBinsModel = require('../models/').storage_bins;
const RoleModel = require('../models/').company_roles;
const LocationModel = require('../models/').locations;

RoleModel.hasOne(StorageBinsModel, { foreignKey: "role_id" });
StorageBinsModel.belongsTo(RoleModel, { foreignKey: "role_id" });

LocationModel.hasOne(StorageBinsModel, { foreignKey: "location_id" });
StorageBinsModel.belongsTo(LocationModel, { foreignKey: "location_id" });
const storage_bins = {
    /**
    * @owner Kapil
    * @description add location
    */
    add: async (req, res) => {
        try {
            let validator = new v(req.body, {
                name: "required",
                roleId: "required",
                locationId: "required",
                defaultbin: "required",
                description: "required",
            });

            let matched = await validator.check();
            if (!matched) {
                return res.status(200).send({ success: "0", message: validator.errors });
            }

            let count = await StorageBinsModel.count({
                where: {
                    location_id: req.body.locationId,
                    name: req.body.name,
                    is_deleted: false
                }
            });

            if (count > 0) {
                return res.send({ success: 0, message: "Bin is already added in this location!" });
            }
            let checkDefaultBin = await StorageBinsModel.count({
                where: {
                    location_id: req.body.locationId,
                    is_default_bin: true,
                    is_deleted: false
                }
            })
            if (req.body.defaultbin) {
                if (checkDefaultBin > 0) {
                    return res.send({ success: 0, message: "Default bin is already added." });
                }
            }
            else {
                if (checkDefaultBin == 0) {
                    return res.send({ success: 0, message: "First add your default bin in location." });
                }
            }
            await StorageBinsModel.create({
                name: req.body.name,
                location_id: req.body.locationId,
                description: req.body.description,
                role_id: req.body.roleId,
                is_default_bin: req.body.defaultbin,
            })
            return res.send({ success: 1, message: "Storage Bin has added successfully!" });
        }
        catch {
            logger.error(req, error.message);
            return res.status(500).send({ message: error.toString() });
        }
    },
    getBinList: async (req, res) => {
        try {
            let storageBins = await StorageBinsModel.findAll({
                attributes: ['id', 'name', 'description', 'is_default_bin', 'role_id', 'location_id'],
                include: [
                    {
                        model: RoleModel,
                        attributes: ['id', 'name']
                    },
                    {
                        model: LocationModel,
                        attributes: ['id', 'unique_name']
                    }
                ],
            }).then().catch(function (err) { console.log("err", err); });
            return res.send({ success: 1, data: storageBins });
        } catch (error) {
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
                return res.status(200).send({ success: "0", message: validator.errors });
            }
            let storagebin = await StorageBinsModel.findOne({
                where: {
                    is_deleted: false,
                    id: req.query.id
                },
                include: [{
                    model: RoleModel,
                    attributes: ['id', 'name']
                }],
                attributes: ['id', 'name', 'is_default_bin', 'role_id']
            });

            return res.send({ success: 1, data: storagebin });
        } catch (error) {
            logger.error(req, error.message);
            return res.status(500).send({ message: error.toString() });
        }
    },
    update: async (req, res) => {
        try {
            let validator = new v(req.body, {
                id: "required",
                defaultBin: "required"
            });
            let matched = await validator.check();
            if (!matched) {
                return res.status(200).send({ success: "0", message: validator.errors });
            }
            let bin_details = StorageBinsModel.findOne({
                where: {
                    id: req.body.id
                },
                attributes: ['id', 'location_id', 'is_default_bin', 'name'],
                raw: true
            });
            if (bin_details.name == "In Transit") {
                return res.status(200).send({ success: '0', message: 'You cannot edit In Transit Bin.' });
            }
            if (bin_details.is_default_bin == true) {
                return res.status(200).send({ success: '0', message: "You cannot edit default bin" })
            }
            if (bin_details.is_default_bin == false && req.body.defaultBin == true) {
                //change default bin
                await StorageBinsModel.update({
                    is_default_bin: false
                }, {
                    where: {
                        location_id: bin_details.location_id,
                        is_default_bin: true
                    }
                });

                await StorageBinsModel.update({
                    is_default_bin: true
                }, {
                    where: {
                        id: req.body.id
                    }
                })
            }
            await StorageBinsModel.update({
                is_default_bin: req.body.defaultBin
            }, {
                where: {
                    id: req.body.id
                }
            });
            return res.send({ success: 1 });
        }
        catch {
            logger.error(req, error.message);
            return res.status(500).send({ message: error.toString() });
        }
    }
};

module.exports = storage_bins;