'use strict';
module.exports = (sequelize, DataTypes) => {
  const categories = sequelize.define('categories', {
    brand_id: DataTypes.BIGINT,
    // id: { type: DataTypes.UUID, primaryKey: true },
    name: DataTypes.STRING,
    code: DataTypes.STRING,
    status: DataTypes.BOOLEAN,
    created_by: DataTypes.UUID,
    updated_by: DataTypes.UUID,
    is_deleted: DataTypes.BOOLEAN
  }, {});
  categories.associate = function (models) {
    // associations can be defined here
  };
  categories.sync({ alter: false });
  return categories;
};