'use strict';
module.exports = (sequelize, DataTypes) => {
  const ZRT = sequelize.define('ZRT', {
    state: DataTypes.STRING,
    district: DataTypes.STRING,
    taluka: DataTypes.STRING,
    village: DataTypes.STRING,
    territory: DataTypes.STRING,
    region: DataTypes.STRING,
    Zone: DataTypes.STRING,
  }, { freezeTableName: true, timestamps: true });
  ZRT.associate = function (models) {
  };
  ZRT.sync({ alter: false });
  return ZRT;
};