'use strict';
module.exports = (sequelize, DataTypes) => {
  const qrcodes_bank = sequelize.define('qrcodes_bank', {
    id: { type: DataTypes.UUID, primaryKey: true },
    unique_code: { type: DataTypes.STRING, uniqueKey: true },
    is_consumed: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, { freezeTableName: true });
  qrcodes_bank.associate = function (models) {
    // associations can be defined here
  };
  qrcodes_bank.sync({ alter: false })
  return qrcodes_bank;
};