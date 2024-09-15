'use strict';
module.exports = (sequelize, DataTypes) => {
  const customer_scan_history = sequelize.define('customer_scan_history', {
    code_id: DataTypes.UUID,
    brand_id: DataTypes.BIGINT,
    product_id: DataTypes.UUID,
    customer_id: DataTypes.UUID,
    latitude: DataTypes.DECIMAL(10, 7),
    longitude: DataTypes.DECIMAL(10, 7),
    mobile_platform: DataTypes.INTEGER,
    created_by: DataTypes.UUID,
    updated_by: DataTypes.UUID,
    code: DataTypes.STRING
  }, { freezeTableName: true });
  customer_scan_history.associate = function (models) {
    // associations can be defined here
  };
  customer_scan_history.sync({ alter: false })
  return customer_scan_history;
};