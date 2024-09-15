'use strict';
module.exports = (sequelize, DataTypes) => {
  const products = sequelize.define('products', {
    id: { type: DataTypes.UUID, primaryKey: true },
    name: DataTypes.STRING,
    item_code: DataTypes.STRING,
    hsn_code: DataTypes.TEXT,
    image: DataTypes.STRING,
    salt: DataTypes.TEXT,
    dosage_type: DataTypes.STRING,
    content: DataTypes.STRING,
    mrp: DataTypes.NUMERIC,
    packing_size: DataTypes.STRING,

    unit_size: DataTypes.STRING,
    uom: DataTypes.STRING,
    is_verified: DataTypes.BOOLEAN,

    size: DataTypes.FLOAT,

    manufacturer_name: DataTypes.STRING,
    category: DataTypes.INTEGER,
    description: DataTypes.STRING,
    company_id: DataTypes.UUID,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,

    // Remove below fields
    sku: DataTypes.STRING,
    // size: DataTypes.FLOAT,
    u_id: DataTypes.STRING,
    // description: DataTypes.STRING,
    technical_name: DataTypes.STRING,
    standard_unit: DataTypes.STRING,
    // mrp: DataTypes.NUMERIC,
    reg_no: DataTypes.STRING,
    gtin: DataTypes.STRING,
    caution_logo: DataTypes.STRING,
    packaging_type: DataTypes.INTEGER,
    is_secondary: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_tertiary: { type: DataTypes.BOOLEAN, defaultValue: false },
    secondary_size: DataTypes.INTEGER,
    tertiary_size: DataTypes.INTEGER,
    outer_size: DataTypes.INTEGER,
    is_general: { type: DataTypes.BOOLEAN, defaultValue: false },   // true for a general product 
    is_mapp_primary: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_mapp_secondary: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_mapp_tertiary: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_mapp_outer: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_loose_allowed: { type: DataTypes.BOOLEAN, defaultValue: false },
    skip_aggregation: { type: DataTypes.BOOLEAN, defaultValue: false },
    product_label: DataTypes.STRING,
    product_leaflet: DataTypes.STRING,
    main_image: DataTypes.STRING,
    created_by: DataTypes.UUID,
    // category: DataTypes.INTEGER,
    product_group: DataTypes.UUID,
    product_range: DataTypes.UUID,
    location_id: DataTypes.UUID,
    marketed_by: DataTypes.UUID,
    antitode_statement: DataTypes.TEXT,
    esign_status: { type: DataTypes.INTEGER, defaultValue: 2 },
    reject_error: { type: DataTypes.STRING },
    approved_by: { type: DataTypes.UUID },
    product_info_web_url: DataTypes.STRING,
    otp: { type: DataTypes.STRING },
    otp_duration: DataTypes.DATE,
  }, {});
  products.associate = function (models) {
    // associations can be defined here
    products.hasOne(models.product_group, {
      foreignKey: 'id',
      sourceKey: 'product_group',
      as: 'product_groups'
    })
    products.hasOne(models.product_range, {
      foreignKey: 'id',
      sourceKey: 'product_range',
      as: 'product_ranges'
    })
    products.hasOne(models.categories, {
      foreignKey: 'id',
      sourceKey: 'category',
      as: 'categorys'
    })
    products.hasOne(models.companies, {
      foreignKey: 'id',
      sourceKey: 'company_id',
    })

    products.hasOne(models.customer_care, {
      foreignKey: 'id',
      sourceKey: 'marketed_by',
    })
  };
  products.sync({ alter: false });
  return products;
};