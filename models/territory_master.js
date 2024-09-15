'use strict';
module.exports = (sequelize, DataTypes) => {
  const terriotory_master = sequelize.define('terriotory_master', {
    id: { type: DataTypes.UUID, primaryKey: true },
    unique_id: DataTypes.STRING,
    name: DataTypes.STRING,
    zone_id: DataTypes.UUID,
    zone_history_id: DataTypes.UUID,
    region_id: DataTypes.UUID,
    region_history_id: DataTypes.UUID,
    terriotory_history_id: DataTypes.UUID,
    talukas: { type: DataTypes.ARRAY(DataTypes.INTEGER), default: [] },
    villages: { type: DataTypes.ARRAY(DataTypes.INTEGER), default: [] },
    district_id: { type: DataTypes.ARRAY(DataTypes.INTEGER), default: [] },
  }, { freezeTableName: true, timestamps: true });
  terriotory_master.associate = function (models) {
  };
  terriotory_master.sync({ alter: false });
  return terriotory_master;
};  