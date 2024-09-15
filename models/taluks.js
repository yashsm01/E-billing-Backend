'use strict';
module.exports = (sequelize, DataTypes) => {
  const taluks = sequelize.define('taluks', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    name: DataTypes.STRING,
    state_id: DataTypes.INTEGER,
    state_code: DataTypes.STRING,
    country_id: DataTypes.INTEGER,
    country_code: DataTypes.STRING,
    district_id: DataTypes.INTEGER,
    district_name: DataTypes.STRING,
    flag: DataTypes.INTEGER,
    wikidataid: DataTypes.STRING,
    is_allocated: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {});
  taluks.associate = function (models) {
    // associations can be defined here
    taluks.hasOne(models.state, {
      foreignKey: 'id',
      sourceKey: 'state_id',
      as: 'state'
    });
  };
  return taluks;
};