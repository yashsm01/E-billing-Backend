'use strict';
module.exports = (sequelize, DataTypes) => {
  const transaction_child = sequelize.define('transaction_child', {
    id: { type: DataTypes.UUID, primaryKey: true },
    transaction_id: { type: DataTypes.UUID },
    level: { type: DataTypes.STRING },
    scanned_code: { type: DataTypes.STRING },
    scanned_code_id: { type: DataTypes.STRING },
    parent_level: { type: DataTypes.STRING },
    parent_code: { type: DataTypes.STRING },
    parent_code_id: { type: DataTypes.UUID },
    has_last_child: { type: DataTypes.BOOLEAN, defaultValue: false },
    has_parent: { type: DataTypes.BOOLEAN, defaultValue: false },
    status: { type: DataTypes.INTEGER },
    type: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, { freezeTableName: true, timestamp: true });
  transaction_child.associate = function (models) {
    // associations can be defined here
    transaction_child.hasOne(models.mapping_transactions, {
      foreignKey: 'id',
      sourceKey: "transaction_id"
    })
  };
  transaction_child.sync({ alter: false })
  return transaction_child;
};

// child_signature: Sequelize.fn( 'array_append', Sequelize.col( 'child_signature' ), recordData ),