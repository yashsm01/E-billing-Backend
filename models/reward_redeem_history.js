'use strict';
module.exports = (sequelize, DataTypes) => {
  const reward_redeem_history = sequelize.define('reward_redeem_history', {
    random_id: DataTypes.STRING,
    address: DataTypes.STRING,
    customer_name: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    voucher_image: DataTypes.STRING,
    pin_code: DataTypes.STRING,
    points: DataTypes.INTEGER,
    brand_id: DataTypes.BIGINT,
    reward_id: DataTypes.UUID,
    consumer_id: DataTypes.UUID,
    verify_by: DataTypes.UUID,
    verify_comments: DataTypes.TEXT,
    created_by: DataTypes.UUID,
    updated_by: DataTypes.UUID,
    is_verified: DataTypes.INTEGER,
    partner_name: DataTypes.STRING,
    transaction_id: DataTypes.STRING,
    is_delivered: DataTypes.BOOLEAN,
    is_luckydraw_reward: DataTypes.BOOLEAN
  }, { freezeTableName: true });
  reward_redeem_history.associate = function (models) {
    // associations can be defined here
  };
  reward_redeem_history.sync({ alter: false })
  return reward_redeem_history;
};
