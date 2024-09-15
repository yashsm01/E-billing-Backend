'use strict';
module.exports = (sequelize, DataTypes) => {
  const customer_reviews = sequelize.define('customer_reviews', {
    ratings: DataTypes.INTEGER,
    comments: DataTypes.STRING,
    customer_id: DataTypes.UUID,
    shortcode_id: DataTypes.UUID,
    is_deleted: DataTypes.BOOLEAN,
  }, {
    freezeTableName: true,
  });
  customer_reviews.associate = function (models) {
    // associations can be defined here
  };
  customer_reviews.sync({ alter: false })
  return customer_reviews;
};