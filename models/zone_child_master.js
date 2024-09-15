'use strict';
module.exports = (sequelize, DataTypes) => {
  const zone_child_master = sequelize.define('zone_child_master', {
    id: { type: DataTypes.UUID, primaryKey: true },
    zone_history_id: DataTypes.UUID,
    zone_id: DataTypes.STRING,
    state_id: DataTypes.INTEGER,
    state_code: DataTypes.STRING,
    parent_zone_id: DataTypes.UUID,
    parent_zone_history_id: DataTypes.UUID,
    cities: { type: DataTypes.ARRAY(DataTypes.INTEGER), default: [] }
  }, { freezeTableName: true, timestamps: true });
  zone_child_master.associate = function (models) {
  };
  zone_child_master.sync({ alter: false });
  return zone_child_master;
};