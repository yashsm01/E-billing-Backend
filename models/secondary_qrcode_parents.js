'use strict';
module.exports = (sequelize, DataTypes) => {
  const secondary_qrcode_parents = sequelize.define('secondary_qrcode_parents', {
    id: { type: DataTypes.UUID, primaryKey: true },
    product_id: DataTypes.UUID,
    batch_id: DataTypes.UUID,
    po_id: DataTypes.UUID,
    total_qrcode: DataTypes.INTEGER,
    u_id: DataTypes.STRING,
    location_id: DataTypes.UUID,
    custom_text1: DataTypes.STRING,
    custom_text2: DataTypes.STRING,
    custom_text3: DataTypes.STRING,
    custom_text4: DataTypes.STRING,
    custom_text5: DataTypes.STRING,
    status: DataTypes.BOOLEAN,
    is_started: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_by: DataTypes.UUID,
    pending_qrcode: DataTypes.INTEGER,
    is_general: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_open: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_sync: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {});
  secondary_qrcode_parents.associate = function (models) {
    // associations can be defined here
    secondary_qrcode_parents.hasOne(models.products, {
      foreignKey: 'id',
      sourceKey: 'product_id'
    })
    secondary_qrcode_parents.hasOne(models.locations, {
      foreignKey: 'id',
      sourceKey: 'location_id'
    })
    secondary_qrcode_parents.hasOne(models.production_orders, {
      foreignKey: 'id',
      sourceKey: 'po_id'
    })
    secondary_qrcode_parents.hasOne(models.product_batches, {
      foreignKey: 'id',
      sourceKey: 'batch_id'
    })
    secondary_qrcode_parents.hasOne(models.company_users, {
      foreignKey: 'id',
      sourceKey: 'created_by'
    })
  };
  secondary_qrcode_parents.sync({ alter: false })
  return secondary_qrcode_parents;
};
