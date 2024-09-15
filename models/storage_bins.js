'use strict';
module.exports = (sequelize, DataTypes) => {
  const storage_bins = sequelize.define('storage_bins', {
    name: DataTypes.STRING,
    description: DataTypes.STRING,
    location_id: DataTypes.UUID,
    is_default_bin: { type: DataTypes.BOOLEAN, defaultValue: false },
    status: { type: DataTypes.BOOLEAN, defaultValue: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {});
  storage_bins.associate = function (models) {
    // associations can be defined here
  };
  storage_bins.sync({ alter: false })
  return storage_bins;
};

