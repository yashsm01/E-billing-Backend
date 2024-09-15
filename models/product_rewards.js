'use strict';
module.exports = (sequelize, DataTypes) => {
  const product_rewards = sequelize.define('product_rewards', {
    customer_id: DataTypes.UUID,
    product_id: DataTypes.UUID,
    code: DataTypes.STRING,
    code_id: DataTypes.UUID,
    point: DataTypes.INTEGER,
    is_scanned: DataTypes.BOOLEAN,
    consumer_type: DataTypes.INTEGER,
    is_deleted: DataTypes.BOOLEAN,
    latitude: DataTypes.INTEGER,
    longitude: DataTypes.INTEGER,
    brand_id: DataTypes.BIGINT,
    category_id: DataTypes.UUID,
  }, { freezeTableName: true });
  product_rewards.associate = function (models) {
    // associations can be defined here
  };
  product_rewards.sync({ alter: false })
  return product_rewards;
};
