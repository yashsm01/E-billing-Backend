'use strict';
module.exports = (sequelize, DataTypes) => {
  const sales_trainings = sequelize.define('sales_trainings', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true
    },
    training: DataTypes.STRING,
    training_url: DataTypes.STRING,
    skus: DataTypes.ARRAY(DataTypes.UUID),
    channels: DataTypes.ARRAY(DataTypes.INTEGER),
    designations: DataTypes.ARRAY(DataTypes.INTEGER),
    states: DataTypes.ARRAY(DataTypes.INTEGER),
    start_date: DataTypes.DATE,
    end_date: DataTypes.DATE,
    is_deleted: DataTypes.BOOLEAN,
    status: DataTypes.INTEGER     // 0 Active  1 Pause  2 Stopped
  }, {});
  sales_trainings.associate = function (models) {
    // associations can be defined here    
  };
  sales_trainings.sync({ alter: false })
  return sales_trainings;
};