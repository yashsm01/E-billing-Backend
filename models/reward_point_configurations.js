'use strict';
module.exports = (sequelize, DataTypes) => {
  const reward_point_configurations = sequelize.define('reward_point_configurations', {
    selectType: DataTypes.INTEGER,
    miniNumber: DataTypes.INTEGER,
    maxiNumber: DataTypes.INTEGER,
    selectMode: DataTypes.INTEGER,
    startDate: DataTypes.DATE,
    sku_id: DataTypes.UUID,
    endDate: DataTypes.DATE,
    percentage: DataTypes.FLOAT
  }, {});
  reward_point_configurations.associate = function (models) {
    // associations can be defined here
  };
  reward_point_configurations.sync({ alter: false })
  return reward_point_configurations;
};
