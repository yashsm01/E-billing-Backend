'use strict';
module.exports = (sequelize, DataTypes) => {
  const state = sequelize.define('state', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    name: DataTypes.STRING,
    country_id: DataTypes.INTEGER,
    country_code: DataTypes.STRING,
    fips_code: DataTypes.STRING,
    iso2: DataTypes.STRING,
    flag: DataTypes.INTEGER,
    wikiDataId: DataTypes.STRING,
    st_code: DataTypes.STRING
  }, {});
  state.associate = function (models) {
    // associations can be defined here
    state.hasOne(models.countries, {
      foreignKey: 'id',
      sourceKey: 'country_id',
      as: 'country'
    });
  };
  state.sync({ alter: false })
  return state;
};