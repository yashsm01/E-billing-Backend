'use strict';
module.exports = (sequelize, DataTypes) => {
  const consumers = sequelize.define('consumers', {

    id: { type: DataTypes.UUID, primaryKey: true },
    retailer_id: DataTypes.UUID,
    retail_outlet_id: DataTypes.UUID,
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    pincode: DataTypes.INTEGER,
    country_code: DataTypes.STRING,
    state_id: DataTypes.INTEGER,
    city_id: DataTypes.INTEGER,
    address: DataTypes.STRING,
    discount_percentage: DataTypes.INTEGER,
    is_contact_verified: DataTypes.BOOLEAN,
    is_email_verified: DataTypes.BOOLEAN,
    country_name: DataTypes.STRING,
    state_name: DataTypes.STRING,
    city_name: DataTypes.STRING,

    role_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    dob: DataTypes.DATE,
    gender: DataTypes.STRING,
    points: { type: DataTypes.INTEGER, defaultValue: 0 },
    jwt_token: DataTypes.TEXT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    available_points: { type: DataTypes.INTEGER, defaultValue: 0 },
    blocked_points: { type: DataTypes.INTEGER, defaultValue: 0 },
    utilize_points: { type: DataTypes.INTEGER, defaultValue: 0 },
    bonus_points: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_updated_version: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, { freezeTableName: true, timestamps: true, });
  consumers.associate = function (models) {
    // associations can be defined here
  };
  consumers.sync({ alter: false })
  return consumers;
};