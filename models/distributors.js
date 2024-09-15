'use strict';
module.exports = (sequelize, DataTypes) => {
  const distributors = sequelize.define('distributors', {
    id: { type: DataTypes.UUID, primaryKey: true },
    name: DataTypes.STRING,
    gstin: DataTypes.STRING,
    lic_no: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    pincode: DataTypes.INTEGER,
    country_id: DataTypes.INTEGER,
    state_id: DataTypes.INTEGER,
    city_id: DataTypes.INTEGER,
    address: DataTypes.STRING,

    city_name: DataTypes.STRING,
    state_name: DataTypes.STRING,
    country_name: DataTypes.STRING,

    bank_name: DataTypes.STRING,
    ifsc_code: DataTypes.STRING,
    account_no: DataTypes.STRING

  }, {
    freezeTableName: true,
    timestamps: true
  });
  distributors.associate = function (models) {
    // associations can be defined here
  };
  distributors.sync({ alter: false });
  return distributors;
};