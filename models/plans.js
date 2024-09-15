'use strict';
module.exports = (sequelize, DataTypes) => {
  const plans = sequelize.define('plans', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true
    },
    name: { type: DataTypes.STRING, defaultValue: null },
    features: { type: DataTypes.ARRAY(DataTypes.STRING) },
    amount: { type: DataTypes.NUMERIC, defaultValue: null },
    period: { type: DataTypes.STRING, defaultValue: null },
  }, {
    freezeTableName: true,
    timestamps: true
  });
  plans.associate = function (models) {
    // Define associations if necessary

  };
  plans.sync({ alter: false })
  return plans;
};
