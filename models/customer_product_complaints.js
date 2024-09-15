'use strict';
module.exports = (sequelize, DataTypes) => {
  const customer_product_complaints = sequelize.define('customer_product_complaints', {
    code: DataTypes.STRING,
    customer_id: DataTypes.UUID,
    product_id: DataTypes.UUID,
    front_image: DataTypes.STRING,
    back_image: DataTypes.STRING,
    status: DataTypes.INTEGER,
    verified_by: DataTypes.UUID,
    verified_date_time: DataTypes.DATE,
    verified_comments: DataTypes.TEXT,
    created_by: DataTypes.UUID,
    updated_by: DataTypes.UUID,
    complain_message: DataTypes.STRING,
    purchased_bill: DataTypes.STRING

  }, {});
  customer_product_complaints.associate = function (models) {
    // associations can be defined here
  };
  customer_product_complaints.sync({ alter: false })
  return customer_product_complaints;
};