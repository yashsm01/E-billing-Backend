'use strict';
module.exports = (sequelize, DataTypes) => {
  const zone_master = sequelize.define('zone_master', {
    id: { type: DataTypes.UUID, primaryKey: true },
    unique_id: DataTypes.STRING,
    name: DataTypes.STRING,
    country_id: DataTypes.INTEGER,
    country_code: DataTypes.STRING,
    zone_history_id: DataTypes.UUID,
    parent_zone_id: DataTypes.UUID,
    parent_zone_history_id: DataTypes.UUID,
  }, { freezeTableName: true, timestamps: true });
  zone_master.associate = function (models) {
  };
  zone_master.sync({ alter: false });
  return zone_master;
};