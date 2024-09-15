'use strict';
module.exports = (sequelize, DataTypes) => {
  const point_allocation = sequelize.define('point_allocation', {
    id: { type: DataTypes.UUID, primaryKey: true },
    name: DataTypes.STRING,
    consumer_type: DataTypes.INTEGER,
    category: DataTypes.INTEGER,
    product_group: DataTypes.UUID,
    product_range: DataTypes.UUID,
    sku_id: DataTypes.ARRAY(DataTypes.UUID),
    product_batch: DataTypes.ARRAY(DataTypes.UUID),
    lvl_type: DataTypes.ARRAY(DataTypes.INTEGER),
    states: DataTypes.ARRAY(DataTypes.INTEGER),
    districts: DataTypes.ARRAY(DataTypes.INTEGER),
    location_type: { type: DataTypes.INTEGER, allowNull: 2 },
    hierarchy_type: { type: DataTypes.BOOLEAN, defaultValue: false },
    zones: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
    regions: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
    territories: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
    referance_zones: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
    referance_regions: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
    referance_territories: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
    zrt_type: DataTypes.INTEGER,
    near_expire_on: DataTypes.DATE,

    mode: { type: DataTypes.INTEGER, allowNull: false },
    mode_points: DataTypes.ARRAY(DataTypes.JSONB),
    percentage: DataTypes.FLOAT,
    min: DataTypes.INTEGER,
    max: DataTypes.INTEGER,
    sku_type: DataTypes.INTEGER,
    type: { type: DataTypes.INTEGER, allowNull: false },
    start_date: DataTypes.DATE,
    end_date: DataTypes.DATE,

    min_scanned: DataTypes.INTEGER,//will deleted
    extra_points: DataTypes.INTEGER,//will deleted,
    scheme_type: { type: DataTypes.INTEGER, defaultValue: 0 },
    scheme_points: DataTypes.ARRAY(DataTypes.JSONB),
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    scheme_image: DataTypes.STRING,

    point_valuation_id: { type: DataTypes.UUID },
    current_valuation: { type: DataTypes.NUMERIC },
    redeemed_points: { type: DataTypes.INTEGER, defaultValue: 0 },
    reference_points: { type: DataTypes.INTEGER, defaultValue: 0 },

    esign_status: { type: DataTypes.INTEGER, defaultValue: 1 },
    reject_error: { type: DataTypes.STRING },
    approved_by: { type: DataTypes.UUID },
    otp: { type: DataTypes.STRING },
    otp_duration: DataTypes.DATE,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    freezeTableName: true
  });
  point_allocation.associate = function (models) {
    // associations can be defined here
  };
  point_allocation.sync({ alter: false })
  return point_allocation;
};
