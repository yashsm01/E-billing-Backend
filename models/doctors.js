'use strict';

const { LicenseManager } = require("aws-sdk");

module.exports = (sequelize, DataTypes) => {
  const doctors = sequelize.define('doctors', {
    id: { type: DataTypes.UUID, primaryKey: true },
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    pincode: DataTypes.INTEGER,
    country_code: DataTypes.STRING,
    state_id: DataTypes.INTEGER,
    city_id: DataTypes.INTEGER,
    address: DataTypes.STRING,
    license_No: DataTypes.STRING,
    country_name: DataTypes.STRING,
    state_name: DataTypes.STRING,
    city_name: DataTypes.STRING
  }, {
    freezeTableName: true,
    timestamps: true
  });
  doctors.associate = function (models) {
    // Define associations if necessary

  };
  doctors.sync({ alter: false })
  return doctors;
};
