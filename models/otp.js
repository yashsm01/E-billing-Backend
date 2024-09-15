'use strict';
module.exports = (sequelize, DataTypes) => {
  const otp = sequelize.define('otp', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    otp: DataTypes.STRING,
    expiration_time: DataTypes.DATE,
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true
    }
  }, { freezeTableName: true });
  otp.sync({ alter: false })
  return otp;
};