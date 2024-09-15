'use strict';
module.exports = (sequelize, DataTypes) => {
  const company_users = sequelize.define('company_users', {
    id: { type: DataTypes.UUID, primaryKey: true },
    random_id: DataTypes.STRING,
    role_id: DataTypes.INTEGER,
    company_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    mobile_no: DataTypes.STRING,
    email: DataTypes.STRING,
    is_email_verified: DataTypes.BOOLEAN,
    password: DataTypes.STRING,
    is_deleted: DataTypes.BOOLEAN,
    city_id: DataTypes.INTEGER,
    state_id: DataTypes.INTEGER,
    country_id: DataTypes.INTEGER,
    region_id: DataTypes.INTEGER,
    address: DataTypes.STRING,
    jwt_token: DataTypes.TEXT,
    location_id: DataTypes.UUID,
    sap_jwt_token: DataTypes.TEXT,
    mapping_jwt_token: DataTypes.TEXT,
    is_approved: DataTypes.BOOLEAN,
    last_activity_at: DataTypes.DATE,
    old_password: DataTypes.ARRAY(DataTypes.JSONB),
    is_password_updated: { type: DataTypes.BOOLEAN, defaultValue: true },
    password_expire_on: DataTypes.DATE,
    retailer_id: DataTypes.UUID,
    retail_outlet_id: DataTypes.UUID,
    created_by: DataTypes.UUID,
    updated_by: DataTypes.UUID,
  }, { timeStamps: true });
  company_users.associate = function (models) {
    // associations can be defined here
    company_users.hasOne(models.company_roles, {
      foreignKey: 'id',
      sourceKey: 'role_id'
    });
    company_users.hasOne(models.locations, {
      foreignKey: 'id',
      sourceKey: 'location_id'
    });
    company_users.hasOne(models.retailers, {
      foreignKey: 'id',
      sourceKey: 'retailer_id',
      as: 'retailers'
    });
    company_users.hasOne(models.retailer_outlets, {
      foreignKey: 'id',
      sourceKey: 'retail_outlet_id',
      as: 'retailer_outlets'
    });
  };
  company_users.sync({ alter: false });

  return company_users;
};
