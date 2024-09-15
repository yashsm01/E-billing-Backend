'use strict';
module.exports = (sequelize, DataTypes) => {
  const stock_summary = sequelize.define('stock_summary', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true
    },
    location_id: DataTypes.UUID,
    storage_bin: DataTypes.INTEGER,
    product_id: DataTypes.UUID,
    batch_id: DataTypes.UUID,
    packaging_level: DataTypes.STRING,

    qty: DataTypes.INTEGER,
  }, {
    freezeTableName: true,
    // timestamps: false,
  });

  stock_summary.associate = function (models) {
    stock_summary.hasOne(models.products, {
      foreignKey: 'id',
      sourceKey: 'product_id'
    })

    stock_summary.hasOne(models.product_batches, {
      foreignKey: 'id',
      sourceKey: 'batch_id'
    })

    stock_summary.hasOne(models.locations, {
      foreignKey: 'id',
      sourceKey: 'location_id'
    })

    stock_summary.hasOne(models.storage_bins, {
      foreignKey: 'id',
      sourceKey: 'storage_bin',
      as: 'bin'
    })

  };

  stock_summary.sync({ alter: false })
  return stock_summary;
};
