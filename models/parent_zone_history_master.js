'use strict';
module.exports = (sequelize, DataTypes) => {
  const parent_zone_history_master = sequelize.define('parent_zone_history_master', {
    id: { type: DataTypes.UUID, primaryKey: true },
    zone_id: DataTypes.UUID,
    unique_id: DataTypes.STRING,
    name: DataTypes.STRING,
    country_id: DataTypes.INTEGER,
    country_code: DataTypes.STRING,
    states: { type: DataTypes.ARRAY(DataTypes.INTEGER), default: [] },
  }, { freezeTableName: true, timestamps: true });
  parent_zone_history_master.associate = function (models) {
  };
  parent_zone_history_master.sync({ alter: false });
  return parent_zone_history_master;
};