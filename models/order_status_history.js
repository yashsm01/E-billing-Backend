'use strict';
module.exports = (sequelize, DataTypes) => {
    const order_status_history = sequelize.define('order_status_history', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true
        },
        order_id: DataTypes.UUID,
        status: DataTypes.INTEGER,
        created_by:DataTypes.UUID,
        createdAt: DataTypes.DATE
    }, {
        freezeTableName: true,
        timestamps: false,
    });
    order_status_history.associate = function (models) {
        // associations can be defined here    
    };
    return order_status_history;
};