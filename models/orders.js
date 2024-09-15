'use strict';
module.exports = (sequelize, DataTypes) => {
  const orders = sequelize.define('orders', {
    id: { type: DataTypes.UUID, primaryKey: true },
    order_no: DataTypes.STRING,
    from_location: DataTypes.UUID,
    to_location: DataTypes.UUID,
    order_date: DataTypes.DATE,
    invoice_no: DataTypes.STRING,
    invoice_date: DataTypes.DATE,
    status: DataTypes.INTEGER,
    order_type: DataTypes.INTEGER,
    o_uid: DataTypes.STRING,
    validator: { type: DataTypes.BOOLEAN, defaultValue: false },
    outward_user_id: DataTypes.UUID,
    inward_user_id: DataTypes.UUID,
    total_qty: DataTypes.NUMERIC,
    o_scan_qty: { type: DataTypes.NUMERIC, defaultValue: 0 },
    i_scan_qty: { type: DataTypes.NUMERIC, defaultValue: 0 },
    i_excess_qty: { type: DataTypes.NUMERIC, defaultValue: 0 },
    sr_code: { type: DataTypes.STRING },
    finance_location_id: { type: DataTypes.STRING },
    created_at: DataTypes.INTEGER,
    updated_at: DataTypes.INTEGER,
    created_by: DataTypes.UUID,
    o_erp_sync_status: { type: DataTypes.INTEGER, defaultValue: 1 },  // 1 Pending 2 Sent  3 Failed,
    o_erp_fail_reason: DataTypes.STRING,
    o_erp_sync_at: DataTypes.DATE,
    i_erp_sync_status: { type: DataTypes.INTEGER, defaultValue: 1 },  // 1 Pending 2 Sent  3 Failed,
    i_erp_fail_reason: DataTypes.STRING,
    i_erp_sync_at: DataTypes.DATE,
    is_accept_all_allowed: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_accepted_all: { type: DataTypes.BOOLEAN, defaultValue: false },
    stock_impact: DataTypes.TEXT,
    o_completed_by: DataTypes.UUID,
    i_completed_by: DataTypes.UUID,
    indent_no: DataTypes.STRING,
    stock_impact_done: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_order_processed: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_completion_error: DataTypes.STRING,
    is_in_progress: { type: DataTypes.BOOLEAN, defaultValue: false },
    started_at: DataTypes.DATE,
    ended_at: DataTypes.DATE,
    delivery_no: { type: DataTypes.STRING },
    impact_in_progress: { type: DataTypes.BOOLEAN, defaultValue: false },
    ref_invoice_no: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    cancel_invoice_no: DataTypes.STRING,
    cancel_invoice_date: DataTypes.DATE,
  }, {
    freezeTableName: true,
  });
  orders.associate = function (models) {
    orders.hasOne(models.locations, {
      foreignKey: 'id',
      sourceKey: 'from_location',
      as: 'from'
    })
    orders.hasOne(models.locations, {
      foreignKey: 'id',
      sourceKey: 'to_location',
      as: 'to'
    })
  };
  orders.sync({ alter: false })
  return orders;
};