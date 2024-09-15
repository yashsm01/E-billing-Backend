'use strict';
module.exports = (sequelize, DataTypes) => {
  const pincodes = sequelize.define('pincodes', {
    pincode: DataTypes.INTEGER,
    state_id: DataTypes.INTEGER,
    // district_id: DataTypes.INTEGER,
    // taluks_id: DataTypes.INTEGER,
    city_id: DataTypes.INTEGER,
    latitude: DataTypes.FLOAT,
    longitude: DataTypes.FLOAT,
  }, {});
  pincodes.associate = function (models) {
    // associations can be defined here
    pincodes.hasOne(models.city, {
      foreignKey: 'id',
      sourceKey: 'city_id',
      as: 'city'
    });
    pincodes.hasOne(models.state, {
      foreignKey: 'id',
      sourceKey: 'state_id',
      as: 'state'
    });
  };
  return pincodes;
};