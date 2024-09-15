'use strict';
module.exports = (sequelize, DataTypes) => {
  const parent_zone_master = sequelize.define('parent_zone_master', {
    id: { type: DataTypes.UUID, primaryKey: true },
    unique_id: DataTypes.STRING,
    name: DataTypes.STRING,
    country_id: DataTypes.INTEGER,
    country_code: DataTypes.STRING,
    states: { type: DataTypes.ARRAY(DataTypes.INTEGER), default: [] },
    zone_history_id: DataTypes.UUID
  }, { freezeTableName: true, timestamps: true });
  parent_zone_master.associate = function (models) {
  };
  parent_zone_master.sync({ alter: false });
  return parent_zone_master;
};