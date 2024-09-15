'use strict';
module.exports = (sequelize, DataTypes) => {
  const replacement_history = sequelize.define('replacement_history', {
    id: { type: DataTypes.UUID, primaryKey: true },
    product_id: DataTypes.UUID,
    batch_id: DataTypes.UUID,
    packaging_level: DataTypes.STRING,
    code: DataTypes.STRING,
    code_type: DataTypes.STRING,
    replaced_with: DataTypes.STRING,
    replaced_with_type: DataTypes.STRING,
    replaced_at: DataTypes.DATE,
    replaced_by: DataTypes.UUID,
    location_id: DataTypes.UUID,
    device_id: DataTypes.INTEGER,
  }, { freezeTableName: true });
  replacement_history.associate = function (models) {
    // associations can be defined here
    replacement_history.hasOne(models.products, {
      foreignKey: 'id',
      sourceKey: 'product_id'
    })
    replacement_history.hasOne(models.product_batches, {
      foreignKey: 'id',
      sourceKey: 'batch_id'
    })
    replacement_history.hasOne(models.locations, {
      foreignKey: 'id',
      sourceKey: 'location_id'
    })
    replacement_history.hasOne(models.company_users, {
      foreignKey: 'id',
      sourceKey: 'replaced_by'
    })
    replacement_history.hasOne(models.devices, {
      foreignKey: 'id',
      sourceKey: 'device_id'
    })
  };
  replacement_history.sync({ alter: false })
  return replacement_history;
};