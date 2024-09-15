'use strict';
module.exports = (sequelize, DataTypes) => {
    const invoices = sequelize.define('invoices', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true
        },
        order_id: DataTypes.UUID,
        invoice_no: DataTypes.STRING,
        date:DataTypes.DATE,
        is_cancelled:DataTypes.BOOLEAN,
        createdAt: DataTypes.DATE,
        updatedAt:DataTypes.DATE
    }, {
        freezeTableName: true,
        timestamps: false,
    });
    invoices.associate = function (models) {
        // associations can be defined here    
    };
    return invoices;
};