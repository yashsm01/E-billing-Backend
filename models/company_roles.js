'use strict';
module.exports = (sequelize, DataTypes) => {
  const company_roles = sequelize.define('company_roles', {
    company_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    status: DataTypes.BOOLEAN,
    is_deleted: DataTypes.BOOLEAN,
    created_by: DataTypes.UUID,
    updated_by: DataTypes.UUID
  }, {});
  company_roles.associate = function (models) {
    // associations can be defined here
  };
  return company_roles;
};