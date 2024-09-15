'use strict';
module.exports = (sequelize, DataTypes) => {
  const districts = sequelize.define('districts', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    name: DataTypes.STRING,
    state_id: DataTypes.INTEGER,
    state_code: DataTypes.STRING,
    country_id: DataTypes.INTEGER,
    country_code: DataTypes.STRING,
    flag: DataTypes.INTEGER,
    is_allocated: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, { freezeTableName: true });

  districts.associate = function (models) {
    // associations can be defined here
    districts.hasOne(models.state, {
      foreignKey: 'id',
      sourceKey: 'state_id',
      as: 'state'
    });
  };
  return districts;
};