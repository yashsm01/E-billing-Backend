'use strict';
module.exports = (sequelize, DataTypes) => {
  const product_offers = sequelize.define('product_offers', {
    main_image: DataTypes.TEXT,
    is_deleted: DataTypes.BOOLEAN,
    redirection_url: DataTypes.STRING,
  }, {});
  product_offers.associate = function (models) {
    // associations can be defined here
  };
  product_offers.sync({ alter: false })
  return product_offers;
};