'use strict';
module.exports = (sequelize, DataTypes) => {
  const retailers = sequelize.define('retailers', {
    id: { type: DataTypes.UUID, primaryKey: true },
    name: DataTypes.STRING,
    email: DataTypes.STRING,
    mobile_no: DataTypes.STRING,
    table_uid: DataTypes.STRING,
  }, { freezeTableName: true });

  retailers.associate = function (models) {
    // associations can be defined here
  };
  retailers.sync({ alter: false })
  return retailers;
};