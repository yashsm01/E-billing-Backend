'use strict';
module.exports = (sequelize, DataTypes) => {
  const user_device_detail = sequelize.define('user_device_detail', {
    user_id: DataTypes.UUID,
    platform: DataTypes.INTEGER,
    device_type: DataTypes.INTEGER,
    device_token: DataTypes.TEXT,
    os: DataTypes.STRING,
    app_version: DataTypes.INTEGER,
    latitude: DataTypes.STRING,
    longitude: DataTypes.STRING,
    status: DataTypes.BOOLEAN,
    is_deleted: DataTypes.BOOLEAN
  }, {});
  user_device_detail.associate = function(models) {
    // associations can be defined here
  };
  return user_device_detail;
};