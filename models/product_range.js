'use strict';
module.exports = (sequelize, DataTypes) => {
  const product_range = sequelize.define('product_range', {
    id: { type: DataTypes.UUID, primaryKey: true },
    code: DataTypes.STRING,
    name: DataTypes.STRING,
    status: DataTypes.BOOLEAN,
    created_by: DataTypes.UUID,
    updated_by: DataTypes.UUID,
    is_deleted: DataTypes.BOOLEAN
  }, {});
  product_range.associate = function (models) {
    // associations can be defined here
  };
  product_range.sync({ alter: false });
  return product_range;
};