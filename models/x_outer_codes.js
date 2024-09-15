'use strict';
module.exports = (sequelize, DataTypes) => {
  const x_company_codes = sequelize.define('x_company_codes', {
    id: { primaryKey: true, type: DataTypes.UUID },
    unique_code: DataTypes.STRING,
    level: DataTypes.STRING,
    u_id: DataTypes.STRING

  }, { freezeTableName: true });

  x_company_codes.associate = function (models) {
  };

  x_company_codes.sync({ alter: false });
  return x_company_codes;
};