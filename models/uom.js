'use strict';
module.exports = (sequelize, DataTypes) => {
  const uom = sequelize.define('uom', {
    id: { primaryKey: true, type: DataTypes.INTEGER },
    name: DataTypes.STRING,
    value: DataTypes.STRING,
  }, {
    freezeTableName: true,
  });
  uom.associate = function (models) {
    // associations can be defined here
  };
  uom.sync({ alter: false })
  return uom;
};