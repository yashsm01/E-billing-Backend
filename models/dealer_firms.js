'use strict';
module.exports = (sequelize, DataTypes) => {
  const dealer_firms = sequelize.define('dealer_firms', {
    id: { type: DataTypes.UUID, primaryKey: true },
    dealer_id: DataTypes.UUID,
    firm_name: DataTypes.STRING,
    address: DataTypes.STRING,
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {});
  dealer_firms.associate = function (models) {
    // associations can be defined here
  };
  dealer_firms.sync({ alter: false })
  return dealer_firms;
};