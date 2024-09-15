'use strict';
module.exports = (sequelize, DataTypes) => {
  const qrcode_allocation_history = sequelize.define('qrcode_allocation_history', {
    id: { type: DataTypes.UUID, primaryKey: true },
    codes_utilized: DataTypes.INTEGER,
    parent_id: DataTypes.UUID,
    level_code: DataTypes.STRING
  }, { freezeTableName: true });
  qrcode_allocation_history.associate = function (models) {
    // associations can be defined here
  };
  // qrcode_allocation_history.sync({ alter: false })
  return qrcode_allocation_history;
};