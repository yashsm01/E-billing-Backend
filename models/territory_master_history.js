'use strict';
module.exports = (sequelize, DataTypes) => {
  const territory_master_history = sequelize.define('territory_master_history', {
    id: { type: DataTypes.UUID, primaryKey: true },
    unique_id: DataTypes.STRING,
    name: DataTypes.STRING,
    territory_id: DataTypes.UUID,
    zone_id: DataTypes.UUID,
    zone_history_id: DataTypes.UUID,
    region_id: DataTypes.UUID,
    region_history_id: DataTypes.UUID,
    terriotory_history_id: DataTypes.UUID,
    talukas: { type: DataTypes.ARRAY(DataTypes.INTEGER), default: [] },
    villages: { type: DataTypes.ARRAY(DataTypes.INTEGER), default: [] },
    district_id: { type: DataTypes.ARRAY(DataTypes.INTEGER), default: [] },
  }, { freezeTableName: true, timestamps: true });
  territory_master_history.associate = function (models) {
  };
  territory_master_history.sync({ alter: false });
  return territory_master_history;
};