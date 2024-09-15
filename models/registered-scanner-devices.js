'use strict';
module.exports = (sequelize, DataTypes) => {
    const registered_scanner_devices = sequelize.define('registered_scanner_devices', {        
        location_id: DataTypes.UUID,
        unique_id: DataTypes.STRING,
        is_active: DataTypes.BOOLEAN,      
        mapping_jwt_token: DataTypes.STRING,
	createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE       
    }, {});
    registered_scanner_devices.associate = function (models) {
        // associations can be defined here
    };
    return registered_scanner_devices;
};
