'use strict';
module.exports = (sequelize, DataTypes) => {
  const devices = sequelize.define('devices', {
    is_active: DataTypes.BOOLEAN,
    u_id: DataTypes.STRING,
    location_id: DataTypes.UUID,
    asset_id: DataTypes.STRING,
    esign_status: { type: DataTypes.INTEGER, defaultValue: 1 },
    reject_error: { type: DataTypes.STRING },
    approved_by: { type: DataTypes.UUID }
  }, {
    freezeTableName: true,
  });
  devices.associate = function (models) {
    // associations can be defined here
  };
  devices.sync({ alter: false })
  return devices;
};