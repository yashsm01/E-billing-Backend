'use strict';
module.exports = (sequelize, DataTypes) => {
  const city = sequelize.define('city', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    name: DataTypes.STRING,
    state_id: DataTypes.INTEGER,
    state_code: DataTypes.STRING,
    country_id: DataTypes.INTEGER,
    country_code: DataTypes.STRING,
    latitude: DataTypes.FLOAT,
    longitude: DataTypes.FLOAT,
    flag: DataTypes.INTEGER,
    wikidataid: DataTypes.STRING,
  }, {});
  city.associate = function (models) {
    // associations can be defined here
    city.hasOne(models.state, {
      foreignKey: 'id',
      sourceKey: 'state_id',
      as: 'state'
    });
  };

  return city;
};