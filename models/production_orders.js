'use strict';
module.exports = (sequelize, DataTypes) => {
  const production_orders = sequelize.define('production_orders', {
    id: { type: DataTypes.UUID, primaryKey: true },
    po_number: { type: DataTypes.STRING, unique: true },
    product_id: DataTypes.UUID,
    batch_size: DataTypes.STRING,
    batch_no: DataTypes.STRING,
    batch_id: DataTypes.UUID,
    // mfg_date: DataTypes.DATE,
    // exp_date: DataTypes.DATE,
    location_id: DataTypes.UUID,
    // case_mrp: DataTypes.NUMERIC,
    po_date: DataTypes.DATE,
    primary_codes: DataTypes.INTEGER,
    secondary_codes: DataTypes.INTEGER,
    tertiary_codes: DataTypes.INTEGER,
    outer_codes: DataTypes.INTEGER,
    status: { type: DataTypes.INTEGER, defaultValue: 1 },
    // created_at: DataTypes.INTEGER,
    // updated_at: DataTypes.INTEGER,
    po_code: DataTypes.STRING,
    is_from_erp: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_by: DataTypes.UUID,
    mapped_outers: { type: DataTypes.INTEGER, defaultValue: 0 },
    url: { type: DataTypes.STRING, defaultValue: null },
    code_prefix: { type: DataTypes.STRING, defaultValue: null },
    serialize_digit: { type: DataTypes.INTEGER, defaultValue: 0 },
    serialize_status: { type: DataTypes.BOOLEAN, defaultValue: false },
    manual_po_status: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_3p: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_sync: { type: DataTypes.BOOLEAN, defaultValue: false },
    esign_status: { type: DataTypes.INTEGER, defaultValue: 2 },
    reject_error: { type: DataTypes.STRING },
    approved_by: { type: DataTypes.UUID }
  }, {});
  production_orders.associate = function (models) {
    production_orders.hasOne(models.products, {
      foreignKey: 'id',
      sourceKey: 'product_id'
    })
    production_orders.hasOne(models.locations, {
      foreignKey: 'id',
      sourceKey: 'location_id'
    })
    production_orders.hasOne(models.product_batches, {
      foreignKey: 'id',
      sourceKey: 'batch_id'
    })
  };
  production_orders.sync({ alter: false })
  return production_orders;
};