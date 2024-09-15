'use strict';
module.exports = (sequelize, DataTypes) => {
  const channelPartners = sequelize.define('channel_partners', {
    id: { type: DataTypes.UUID, primaryKey: true },
    // type: DataTypes.INTEGER,
    name: DataTypes.STRING,
    dob: DataTypes.DATE,
    country_code: DataTypes.STRING,
    phone: DataTypes.STRING,
    firm_name: DataTypes.STRING,
    est_date: DataTypes.DATE,
    address: DataTypes.STRING,
    zone_id: DataTypes.UUID,
    region_id: DataTypes.UUID,
    territory_id: DataTypes.UUID,
    state_id: DataTypes.INTEGER,
    city_id: DataTypes.INTEGER,
    pin_code: DataTypes.INTEGER,

    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,

    // points: { type: DataTypes.INTEGER, defaultValue: 0 },
    // is_verified: DataTypes.BOOLEAN,
    // remark: DataTypes.STRING,
    email: DataTypes.STRING,
    jwt_token: DataTypes.TEXT,
    gender: DataTypes.STRING,
    // doa: DataTypes.DATE,
    // is_profile_updated: DataTypes.BOOLEAN,
    role_id: DataTypes.INTEGER,
    points: { type: DataTypes.INTEGER, defaultValue: 0 },
    available_points: { type: DataTypes.INTEGER, defaultValue: 0 },
    blocked_points: { type: DataTypes.INTEGER, defaultValue: 0 },
    utilize_points: { type: DataTypes.INTEGER, defaultValue: 0 },
    bonus_points: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_updated_version: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, { freezeTableName: true });
  channelPartners.associate = function (models) {
    // associations can be defined here
  };
  channelPartners.sync({ alter: false })
  return channelPartners;
};