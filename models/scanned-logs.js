'use strict';
module.exports = (sequelize, DataTypes) => {
    const scanned_logs = sequelize.define('scanned_logs', {
        is_completed: DataTypes.BOOLEAN,
        assign_user_id: DataTypes.UUID,
        product_id: DataTypes.UUID,
        batch_id: DataTypes.UUID,
        sku_logs: DataTypes.STRING,
        fst_inner_logs: DataTypes.STRING,
        snd_inner_logs: DataTypes.STRING,
        last_scanned: DataTypes.STRING
    }, {
        freezeTableName: true
    });
    scanned_logs.associate = function (models) {
        // associations can be defined here
    };
    return scanned_logs;
};
