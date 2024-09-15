'use strict';
module.exports = (sequelize, DataTypes) => {
  const customer_product_s = sequelize.define('customer_product_s', {
    customer_id: DataTypes.UUID,
    product_id: DataTypes.UUID,
    code_id: DataTypes.UUID,
    //status: DataTypes.BOOLEAN,
    //verified_by: DataTypes.UUID,
    //verified_date_time: DataTypes.DATE,
    //verified_comments: DataTypes.TEXT,
    //created_by: DataTypes.UUID,
    //updated_by: DataTypes.UUID,
    latitude: DataTypes.STRING,
    longitude: DataTypes.STRING,
    code: DataTypes.STRING,
    consumer_type: DataTypes.INTEGER,
    city_id: DataTypes.INTEGER,
    //claim_id: DataTypes.UUID,
    warranty_id: DataTypes.UUID,
    brand_id: DataTypes.BIGINT,
    category_id: DataTypes.UUID,
    point: DataTypes.INTEGER,
    point_allocated: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_authenticated: { type: DataTypes.BOOLEAN, defaultValue: false },
    authenticated_at: DataTypes.DATE,
    is_scanned: { type: DataTypes.BOOLEAN, defaultValue: false },
    reward_id: DataTypes.UUID
  }, { freezeTableName: true });
  customer_product_s.associate = function (models) {
    // associations can be defined here
  };
  customer_product_s.sync({ alter: false })
  return customer_product_s;
};