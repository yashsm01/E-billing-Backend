'use strict';
module.exports = (sequelize, DataTypes) => {
  const product_batches = sequelize.define('product_batches', {
    id: { type: DataTypes.UUID, primaryKey: true },
    batch_no: DataTypes.STRING,
    product_id: DataTypes.UUID,
    mfg_loc_id: DataTypes.UUID,
    mfg_date: DataTypes.DATE,
    exp_date: DataTypes.DATE,
    mrp: DataTypes.NUMERIC,
    main_image: DataTypes.STRING,


    //Product Attributes
    size: DataTypes.FLOAT,
    standard_unit: DataTypes.STRING,
    shelf_life: DataTypes.INTEGER,
    packaging_type: DataTypes.INTEGER,
    is_secondary: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_tertiary: { type: DataTypes.BOOLEAN, defaultValue: false },
    secondary_size: DataTypes.INTEGER,
    tertiary_size: DataTypes.INTEGER,
    outer_size: DataTypes.INTEGER,
    is_mapp_primary: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_mapp_secondary: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_mapp_tertiary: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_mapp_outer: { type: DataTypes.BOOLEAN, defaultValue: false },
    p_factor: DataTypes.NUMERIC,
    s_factor: DataTypes.NUMERIC,
    t_factor: DataTypes.NUMERIC,
    o_factor: DataTypes.NUMERIC,
    is_loose_allowed: { type: DataTypes.BOOLEAN, defaultValue: false },
    skip_aggregation: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_by: DataTypes.UUID,
    location_id: DataTypes.UUID,
    product_label: DataTypes.STRING,
    product_leaflet: DataTypes.STRING,
    is_third_party: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {});
  product_batches.associate = function (models) {
    // associations can be defined here
    product_batches.hasOne(models.products, {
      foreignKey: 'id',
      sourceKey: 'product_id'
    })
    product_batches.hasOne(models.locations, {
      foreignKey: 'id',
      sourceKey: 'location_id'
    })
  };
  product_batches.sync({ alter: false })
  return product_batches;
};