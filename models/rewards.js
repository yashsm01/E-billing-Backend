'use strict';
module.exports = (sequelize, DataTypes) => {
  const rewards = sequelize.define('rewards', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true
    },
    reward_id: DataTypes.STRING,
    name: DataTypes.STRING,
    points: DataTypes.INTEGER,
    stock: DataTypes.INTEGER,
    image: DataTypes.STRING,
    user_type: DataTypes.INTEGER,
    redeemed_stock: { type: DataTypes.INTEGER, defaultValue: 0 },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    bonus_points: DataTypes.INTEGER,
    is_wallet_based: DataTypes.BOOLEAN,
    is_luckydraw_reward: DataTypes.BOOLEAN
  }, {});
  rewards.associate = function (models) {
    // associations can be defined here
  };
  rewards.sync({ alter: false })
  return rewards;
};
