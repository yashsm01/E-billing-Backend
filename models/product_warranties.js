'use strict';
module.exports = (sequelize, DataTypes) => {
  const product_warranties = sequelize.define('product_warranties', {
    customer_id: DataTypes.UUID,
    product_id: DataTypes.UUID,
    code: DataTypes.STRING,
    code_id: DataTypes.UUID,
    is_scanned: DataTypes.BOOLEAN,
    consumer_type: DataTypes.INTEGER,
    is_deleted: DataTypes.BOOLEAN,
    latitude: DataTypes.INTEGER,
    longitude: DataTypes.INTEGER,
    seller_name: DataTypes.STRING,
    invoice_no: DataTypes.STRING,
    invoice_date: DataTypes.DATE,
    address: DataTypes.STRING,
    pincode: DataTypes.STRING,
    expires_by: DataTypes.DATE,
    is_active: DataTypes.BOOLEAN,
    city_id: DataTypes.STRING,
    purchased_from: DataTypes.STRING,
    bill_image: DataTypes.STRING,
    warranty_tag_image: DataTypes.STRING
  }, { freezeTableName: true });
  product_warranties.associate = function (models) {
    // associations can be defined here
  };
  product_warranties.sync({ alter: false })
  return product_warranties;
};