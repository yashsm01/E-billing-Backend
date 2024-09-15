'use strict';
module.exports = (sequelize, DataTypes) => {
  const adjustments_codes = sequelize.define('adjustments_codes', {
    id: { type: DataTypes.UUID, primaryKey: true },
    adjustment_id: DataTypes.UUID,
    unique_code: DataTypes.STRING,
    product_id: DataTypes.UUID,
    sku: DataTypes.STRING,
    batch_id: DataTypes.STRING,
    batch_no: DataTypes.STRING,
    packaging_level: DataTypes.STRING,
    packaging_qty: DataTypes.FLOAT,
    location_id: DataTypes.UUID,
    storage_bin_id: DataTypes.INTEGER,
    parent_id: DataTypes.UUID,
    user_id: DataTypes.UUID,
    parent_code: DataTypes.STRING,
    is_invalid: { type: DataTypes.BOOLEAN, defaultValue: false },
    reason: { type: DataTypes.STRING },
    packaging_transaction: DataTypes.STRING,
    u_id: DataTypes.STRING,

    code_id: DataTypes.UUID,
    is_box_opened: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_replaced: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_scanned: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_complete: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_mapped: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
    location_code: DataTypes.STRING
  }, {
    freezeTableName: true,
  });
  adjustments_codes.associate = function (models) {

    adjustments_codes.hasOne(models.storage_bins, {
      foreignKey: "id",
      sourceKey: "storage_bin_id",
    })
  };
  adjustments_codes.sync({ alter: false })
  return adjustments_codes;
};