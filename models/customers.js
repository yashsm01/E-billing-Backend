'use strict';
module.exports = (sequelize, DataTypes) => {
  const Customers = sequelize.define('customers', {
    refferal_customer_id: DataTypes.UUID,
    pre: DataTypes.STRING,
    name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    country_code: DataTypes.STRING,
    cellnumber: DataTypes.STRING,
    email: DataTypes.STRING,
    is_active: DataTypes.BOOLEAN,
    dob_month: DataTypes.INTEGER,
    dob_year: DataTypes.INTEGER,
    main_image: DataTypes.TEXT,
    thumb_image: DataTypes.TEXT,
    latitude: DataTypes.DECIMAL(10,7),
    longitude: DataTypes.DECIMAL(10,7),
    is_deleted: DataTypes.BOOLEAN,
    created_by: DataTypes.INTEGER,
    updated_by: DataTypes.INTEGER,
    gender:DataTypes.STRING,
    is_profile_updated:DataTypes.BOOLEAN,
    is_guest_user:DataTypes.BOOLEAN,
    role_id: DataTypes.INTEGER,
    state_id: DataTypes.INTEGER,
    pincode: DataTypes.STRING,
    city_id: DataTypes.INTEGER,

  }, {freezeTableName: true});
  Customers.associate = function(models) {
    // associations can be defined here
  };
  return Customers;
};