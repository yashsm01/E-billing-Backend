'use strict';

module.exports = (sequelize, DataTypes) => {
  const locations = sequelize.define('locations', {
    id: { type: DataTypes.UUID, primaryKey: true },
    name: { type: DataTypes.STRING },
    unique_name: { type: DataTypes.STRING },
    address: DataTypes.STRING,
    company_id: DataTypes.UUID,
    city_id: DataTypes.INTEGER,
    state_id: DataTypes.INTEGER,
    country_id: DataTypes.INTEGER,

    //Remove below fields
    transfer_validator: { type: DataTypes.BOOLEAN, defaultValue: false },
    sales_validator: { type: DataTypes.BOOLEAN, defaultValue: false },
    allow_sync: { type: DataTypes.BOOLEAN, defaultValue: false },
    return_validator: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_customer: { type: DataTypes.BOOLEAN, defaultValue: false },
    finance_location_id: { type: DataTypes.UUID, },
    finance_locations: { type: DataTypes.ARRAY(DataTypes.STRING) },
    finance_customer_id: { type: DataTypes.STRING },
    customer_status: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_uploaded: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    last_sync_at: DataTypes.DATE,
    sync_error: DataTypes.STRING,
    sync_code: DataTypes.STRING,
    code: DataTypes.STRING,
    zone_id: DataTypes.UUID,
    region_id: DataTypes.UUID,
    territory_id: DataTypes.UUID,
    licence_no: { type: DataTypes.STRING },
    tenant_id: { type: DataTypes.STRING },
    api_key: { type: DataTypes.STRING },
    sap_state_code: DataTypes.STRING,
    sap_city_name: DataTypes.STRING,
  }, {});
  locations.associate = function (models) {
    // associations can be defined here  
    locations.hasOne(models.city, {
      foreignKey: 'id',
      sourceKey: 'city_id',
      as: 'city'
    });

    locations.hasOne(models.state, {
      foreignKey: 'id',
      sourceKey: 'state_id',
      as: 'state'
    });

    locations.hasOne(models.countries, {
      foreignKey: 'id',
      sourceKey: 'country_id',
      as: 'country'
    });

    locations.hasOne(models.companies, {
      foreignKey: 'id',
      sourceKey: 'company_id',
      as: 'company'
    });


    locations.hasOne(models.storage_bins, {
      foreignKey: 'location_id',
      sourceKey: 'id',
    });
  };

  locations.sync({ alter: false })
  return locations;
};