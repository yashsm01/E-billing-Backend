'use strict';
module.exports = (sequelize, DataTypes) => {
  const product_warranty_claims = sequelize.define('product_warranty_claims', {
    code: DataTypes.STRING,
    customer_id: DataTypes.UUID,
    product_id: DataTypes.UUID,
    front_image: DataTypes.STRING,
    back_image: DataTypes.STRING,
    defected_image: DataTypes.STRING,
    status: DataTypes.INTEGER,
    complain_message: DataTypes.STRING,
    warranty_id: DataTypes.UUID,
    location_id: DataTypes.UUID,
    collection_date: DataTypes.DATE,
    pin_code: DataTypes.INTEGER,
    city_id: DataTypes.INTEGER,
    state_id: DataTypes.INTEGER,
  }, {});
  product_warranty_claims.associate = function (models) {
    // associations can be defined here
  };
  product_warranty_claims.sync({ alter: false })
  return product_warranty_claims;
};