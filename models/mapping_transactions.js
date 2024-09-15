'use strict';
module.exports = (sequelize, DataTypes) => {
  const mapping_transactions = sequelize.define('mapping_transactions', {
    id: { type: DataTypes.UUID, primaryKey: true },
    transaction_id: { type: DataTypes.STRING, allowNull: false, unique: true },
    po_id: DataTypes.UUID,
    product_id: DataTypes.UUID,
    batch_id: DataTypes.UUID,
    packaging_level: DataTypes.STRING,
    packaging_size: DataTypes.INTEGER,
    parents_to_mapped: DataTypes.INTEGER,
    mapped_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    started_at: DataTypes.DATE,
    end_at: DataTypes.DATE,
    status: { type: DataTypes.INTEGER, defaultValue: 0 },  // 0:created, 1:In-progress,2: Completed,
    erp_sync_status: { type: DataTypes.INTEGER, defaultValue: 0 }, // 0:pending, 1:successfull,2: failed,
    erp_sync_at: DataTypes.DATE,
    created_at: DataTypes.INTEGER,
    updated_at: DataTypes.INTEGER,
    created_by: DataTypes.UUID,
    tr_code: DataTypes.STRING,
    device_id: DataTypes.INTEGER,
    u_id: DataTypes.STRING,
    inner_level: DataTypes.STRING,
    storage_bin: DataTypes.INTEGER,
    is_other: { type: DataTypes.BOOLEAN, defaultValue: false },
    gen_uid: DataTypes.STRING,
    has_last_child: { type: DataTypes.BOOLEAN, defaultValue: false },
    location_id: DataTypes.UUID,
    erp_error: DataTypes.STRING
  }, {});
  mapping_transactions.associate = function (models) {
    mapping_transactions.hasOne(models.products, {
      foreignKey: 'id',
      sourceKey: 'product_id'
    })
    mapping_transactions.hasOne(models.production_orders, {
      foreignKey: 'id',
      sourceKey: 'po_id'
    })
    mapping_transactions.hasOne(models.transaction_scanned_info, {
      foreignKey: 'transaction_id',
      sourceKey: 'id'
    })
    mapping_transactions.hasOne(models.company_users, {
      foreignKey: 'id',
      sourceKey: 'created_by'
    })
    mapping_transactions.hasOne(models.devices, {
      foreignKey: 'id',
      sourceKey: 'device_id'
    })
    mapping_transactions.hasOne(models.product_batches, {
      foreignKey: 'id',
      sourceKey: 'batch_id'
    })
    mapping_transactions.hasOne(models.locations, {
      foreignKey: 'id',
      sourceKey: 'location_id'
    })
  };
  mapping_transactions.sync({ alter: false })
  return mapping_transactions;
};