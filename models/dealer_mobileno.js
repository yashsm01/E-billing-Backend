'use strict';
module.exports = (sequelize, DataTypes) => {
  const dealer_mobileno = sequelize.define('dealer_mobileno', {
    id: { type: DataTypes.UUID, primaryKey: true },
    dealer_id: DataTypes.UUID,
    mobile_no: DataTypes.STRING,
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, { freezeTableName: true });
  dealer_mobileno.associate = function (models) {
    // associations can be defined here
  };
  dealer_mobileno.sync({ alter: false })
  return dealer_mobileno;
};