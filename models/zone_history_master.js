'use strict';
module.exports = (sequelize, DataTypes) => {
  const zone_history_master = sequelize.define('zone_history_master', {
    id: { type: DataTypes.UUID, primaryKey: true },
    zone_id: DataTypes.UUID,
    unique_id: DataTypes.STRING,
    name: DataTypes.STRING,
    country_id: DataTypes.INTEGER,
    country_code: DataTypes.STRING,
    parent_zone_id: DataTypes.UUID,
    parent_zone_history_id: DataTypes.UUID,
  }, { freezeTableName: true, timestamps: true });
  zone_history_master.associate = function (models) {
  };
  zone_history_master.sync({ alter: false });
  return zone_history_master;
};