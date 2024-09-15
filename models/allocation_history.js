'use strict';
module.exports = (sequelize, DataTypes) => {
  const allocation_history = sequelize.define('allocation_history', {
    id: { type: DataTypes.UUID, primaryKey: true },
    codes_utilized: DataTypes.INTEGER,
    parent_id: DataTypes.UUID,
    level: DataTypes.STRING
  }, { freezeTableName: true });
  allocation_history.associate = function (models) {
    // associations can be defined here
  };
  // allocation_history.sync({ alter: false })
  return allocation_history;
};