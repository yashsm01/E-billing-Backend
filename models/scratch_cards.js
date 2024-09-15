'use strict';
module.exports = (sequelize, DataTypes) => {
  const scratch_cards = sequelize.define('scratch_cards', {
    id: { type: DataTypes.UUID, primaryKey: true },
    card_type: DataTypes.INTEGER,  // 1 Loyalty Points 2 Lucky Draw
    unique_code: DataTypes.STRING,
    points: { type: DataTypes.INTEGER, defaultValue: 0 },
    draw_id: DataTypes.UUID,
    reward_id: DataTypes.UUID,
    consumer_id: DataTypes.UUID,
    is_scratched: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_discarded: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_locked: { type: DataTypes.BOOLEAN, defaultValue: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, { freezeTableName: true });
  scratch_cards.associate = function (models) {
    // associations can be defined here    
  };
  scratch_cards.sync({ alter: false })
  return scratch_cards;
};