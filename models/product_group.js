'use strict';
module.exports = (sequelize, DataTypes) => {
  const product_group = sequelize.define('product_group', {
    id: { type: DataTypes.UUID, primaryKey: true },
    code: DataTypes.STRING,
    name: DataTypes.STRING,
    status: DataTypes.BOOLEAN,
    created_by: DataTypes.UUID,
    updated_by: DataTypes.UUID,
    is_deleted: DataTypes.BOOLEAN
  }, {});
  product_group.associate = function (models) {
    // associations can be defined here
  };
  product_group.sync({ alter: false });
  return product_group;
};