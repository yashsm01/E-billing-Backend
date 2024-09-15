'use strict';
module.exports = (sequelize, DataTypes) => {
  const points_distribution = sequelize.define('points_distribution', {
    id: { type: DataTypes.UUID, primaryKey: true },
    scheme_id: { type: DataTypes.UUID },
    scheme_type: { type: DataTypes.INTEGER },
    points_distributed: { type: DataTypes.NUMERIC },
    point_valuation_id: { type: DataTypes.UUID },
    current_valuation: { type: DataTypes.NUMERIC },
  }, { freezeTableName: true });
  points_distribution.associate = function (models) {
    // associations can be defined here
  };
  points_distribution.sync({ alter: false })
  return points_distribution;
};