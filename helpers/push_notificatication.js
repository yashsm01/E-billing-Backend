
const fcmConfig = require('../config/fcm_key.json');
const FCM = require('fcm-node');

let PushNotification = (token, pushData, data, device_type) => {

    const fcm = new FCM(fcmConfig.fcm_server_key);

    let message = {};
    message.to = token;
    message.collapse_key = fcmConfig.collapse_key;
    message.data = data;

    if (device_type == 2) {
        message.notification = pushData;
    }

    console.log(message);

    fcm.send(message, function (err, response) {
        if (err) {
            console.log(err);
            return false;
        } else {
            console.log('---notification response--', response);
            return true;
        }
    });

};

module.exports.sendPushNotification = PushNotification;