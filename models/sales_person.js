'use strict';
module.exports = (sequelize, DataTypes) => {
  const sales_persons = sequelize.define('sales_persons', {
    id: { type: DataTypes.UUID, primaryKey: true },
    type: DataTypes.INTEGER,
    name: DataTypes.STRING,
    dob: DataTypes.DATE,
    country_code: DataTypes.STRING,
    phone: DataTypes.STRING,
    address: DataTypes.STRING,
    state_id: DataTypes.INTEGER,
    city_id: DataTypes.INTEGER,
    pin_code: DataTypes.INTEGER,
    is_deleted: DataTypes.BOOLEAN,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    remark: DataTypes.STRING,
    is_consumer: DataTypes.BOOLEAN,
    channel_id: DataTypes.INTEGER,
    emp_id: DataTypes.STRING,
    jwt_token: DataTypes.TEXT,
    profile_image: DataTypes.STRING,
    role_id: DataTypes.INTEGER,
  }, { freezeTableName: true });
  sales_persons.associate = function (models) {
    // associations can be defined here
  };
  sales_persons.sync({ alter: false })
  return sales_persons;
};