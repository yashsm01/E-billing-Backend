'use strict';
module.exports = (sequelize, DataTypes) => {
  const sales_person_trainings = sequelize.define('sales_person_trainings', {
    customer_id: DataTypes.UUID,
    training_id: DataTypes.UUID,
    is_deleted: DataTypes.BOOLEAN,
    latitude: DataTypes.INTEGER,
    longitude: DataTypes.INTEGER,
    score: DataTypes.INTEGER,
    is_watched: DataTypes.BOOLEAN
  }, { freezeTableName: true });
  sales_person_trainings.associate = function (models) {
    // associations can be defined here
  };
  sales_person_trainings.sync({ alter: false })
  return sales_person_trainings;
};
