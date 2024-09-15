'use strict';
module.exports = (sequelize, DataTypes) => {
  const device_details = sequelize.define('device_details', {
    customer_id: DataTypes.UUID,
    device_type: DataTypes.INTEGER,
    device_token: DataTypes.TEXT,
    os: DataTypes.TEXT,
    app_version: DataTypes.STRING,
    is_deleted: DataTypes.BOOLEAN,
    latitude: DataTypes.DECIMAL(10,7),
    longitude: DataTypes.DECIMAL(10,7),
    device_model: DataTypes.STRING

  }, {});
  device_details.associate = function(models) {
    // associations can be defined here
  };
  return device_details;
};