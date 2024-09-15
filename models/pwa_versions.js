'use strict';
module.exports = (sequelize, DataTypes) => {
  const pwa_versions = sequelize.define('pwa_versions', {
    id: { type: DataTypes.UUID, primaryKey: true },
    name: DataTypes.STRING,
    status: DataTypes.BOOLEAN,
    created_by: DataTypes.UUID,
    updated_by: DataTypes.UUID,
    is_deleted: DataTypes.BOOLEAN
  }, {});
  pwa_versions.associate = function (models) {
    // associations can be defined here
  };
  pwa_versions.sync({ alter: false });
  return pwa_versions;
};