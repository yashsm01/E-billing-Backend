'use strict';
module.exports = (sequelize, DataTypes) => {
  const transaction_scanned_info = sequelize.define('transaction_scanned_info', {
    id: { type: DataTypes.UUID, primaryKey: true },
    transaction_id: DataTypes.UUID,
    scanned_codes: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] }
  }, { freezeTableName: true });
  transaction_scanned_info.associate = function (models) {
    // associations can be defined here
    transaction_scanned_info.hasOne(models.mapping_transactions, {
      foreignKey: 'id',
      sourceKey: "transaction_id"
    })
  };
  transaction_scanned_info.sync({ alter: false })
  return transaction_scanned_info;
};

// child_signature: Sequelize.fn( 'array_append', Sequelize.col( 'child_signature' ), recordData ),