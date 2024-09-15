'use strict';
module.exports = (sequelize, DataTypes) => {
  const finance_location = sequelize.define('finance_location', {
    id: { type: DataTypes.UUID, primaryKey: true },
    code: DataTypes.STRING,
    // created_at: DataTypes.INTEGER,
    // updated_at: DataTypes.INTEGER,
  }, {});
  finance_location.associate = function (models) {
    // associations can be defined here
  };
  finance_location.sync({ alter: false });

  return finance_location;
};