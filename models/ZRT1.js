'use strict';
module.exports = (sequelize, DataTypes) => {
  const ZRT1 = sequelize.define('ZRT1', {
    state: DataTypes.STRING,
    district: DataTypes.STRING,
    taluka: DataTypes.STRING,
    village: DataTypes.STRING,
    territory: DataTypes.STRING,
    region: DataTypes.STRING,
    Zone: DataTypes.STRING,
  }, { freezeTableName: true, timestamps: true });
  ZRT1.associate = function (models) {
  };
  return ZRT1;
};