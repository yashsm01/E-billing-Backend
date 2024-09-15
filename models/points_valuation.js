'use strict';
module.exports = (sequelize, DataTypes) => {
  const points_valuation = sequelize.define('points_valuation', {
    id: { type: DataTypes.UUID, primaryKey: true },
    point: { type: DataTypes.NUMERIC }
  }, { freezeTableName: true, timestamps: true });
  points_valuation.associate = function (models) {
  };
  points_valuation.sync({ alter: false });
  return points_valuation;
};