'use strict';
module.exports = (sequelize, DataTypes) => {
  const countries = sequelize.define('countries', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    name: DataTypes.STRING,
    iso3: DataTypes.STRING,
    iso2: DataTypes.STRING,
    phonecode: DataTypes.STRING,
    capital: DataTypes.STRING,
    currency: DataTypes.STRING,
    flag: DataTypes.INTEGER,
    wikiDataId: DataTypes.STRING
  }, {});
  countries.associate = function (models) {
    // associations can be defined here

  };
  return countries;
};