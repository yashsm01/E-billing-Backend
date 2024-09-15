'use strict';
module.exports = (sequelize, DataTypes) => {
  const lucky_draws = sequelize.define('lucky_draws', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true
    },
    consumer_type: DataTypes.INTEGER,
    draw_type: DataTypes.INTEGER,
    start_date: DataTypes.DATE,
    end_date: DataTypes.DATE,
    draw_name: DataTypes.STRING,
    no_of_winners: DataTypes.INTEGER,
    reward_id: DataTypes.UUID,
    draw_desc: DataTypes.STRING,
    min_scanned_prod: DataTypes.INTEGER,
    min_earned_points: DataTypes.INTEGER,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    freq_type: DataTypes.INTEGER,
    week_day: DataTypes.INTEGER,
    month_date: DataTypes.INTEGER,
    required_sku: DataTypes.UUID,
    lvl_type: DataTypes.ARRAY(DataTypes.INTEGER),
    status: DataTypes.INTEGER,
    skus: DataTypes.ARRAY(DataTypes.UUID),
    image: DataTypes.STRING,
    t_and_c: DataTypes.TEXT,
    product_batch: DataTypes.ARRAY(DataTypes.UUID),
    category: DataTypes.INTEGER,
    product_group: DataTypes.UUID,
    product_range: DataTypes.UUID,
    near_expire_on: DataTypes.DATE,
    zones: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
    regions: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
    territories: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
    referance_zones: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
    referance_regions: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
    referance_territories: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
    zrt_type: DataTypes.INTEGER,
    scheme_image: DataTypes.STRING,
    allocated_reward: { type: DataTypes.INTEGER, defaultValue: 0 },
    point_valuation_id: { type: DataTypes.UUID },

    esign_status: { type: DataTypes.INTEGER, defaultValue: 1 },
    reject_error: { type: DataTypes.STRING },
    approved_by: { type: DataTypes.UUID },
    otp: { type: DataTypes.STRING },
    otp_duration: DataTypes.DATE,

    current_valuation: { type: DataTypes.NUMERIC },
    lucky_draw_winners_config: DataTypes.ARRAY(DataTypes.JSONB),
    lucky_draw_reward_outflow: DataTypes.ARRAY(DataTypes.JSONB),
  }, {});
  lucky_draws.associate = function (models) {
    // associations can be defined here    
  };
  lucky_draws.sync({ alter: false })
  return lucky_draws;
};