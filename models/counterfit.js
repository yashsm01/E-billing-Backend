'use strict';
module.exports = (sequelize, DataTypes) => {
  const counterfit = sequelize.define('counterfit', {
    id: { type: DataTypes.UUID, primaryKey: true },
    customer_id: DataTypes.UUID,
    role_id: DataTypes.INTEGER,
    type: DataTypes.INTEGER,
    category_id: DataTypes.INTEGER,
    product_id: DataTypes.UUID,
    batch_id: DataTypes.UUID,
    code_id: DataTypes.UUID,
    unique_code: DataTypes.STRING,
    level: DataTypes.STRING,  // P S T O,
    city_id: DataTypes.INTEGER,
    location_id: DataTypes.UUID,
    latitude: DataTypes.STRING,
    longitude: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    freezeTableName: true,
  });
  counterfit.associate = function (models) {
    // associations can be defined here
  };
  counterfit.sync({ alter: false })
  return counterfit;
};