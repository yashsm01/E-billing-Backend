const NotificationsModel = require("../../models").notifications;
const uuid = require('uuid');
const logger = require("../../helpers/logger");

let notifications = {
  getNotifications: async (req, res) => {
    try {
      let consumerId = req.consumerId;
      let allNotifications = await NotificationsModel.findAll({
        where: {
          consumer_id: consumerId,
          status: 0
        },
        order: [['createdAt', 'DESC']],
        raw: true
      });
      return res.status(200).send({ success: 1, data: allNotifications });

    }
    catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  deleteNotifications: async (req, res) => {
    try {
      await NotificationsModel.destroy({ where: { consumer_id: req.consumerId } });
      return res.status(200).send({ success: '1', message: 'deleted' })

    } catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  updateNotifications: async (req, res) => {
    try {
      await NotificationsModel.update({
        status: 1
      }, {
        where: {
          consumer_id: req.consumerId
        }
      });
      return res.status(200).send({ success: '1', message: 'viewed' })
    }
    catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message })
    }
  },
  async AddNotification(consumer_id, title, desc, type) {
    try {
      await NotificationsModel.create({
        id: uuid(),
        consumer_id: consumer_id,
        title: title,
        desc: desc,
        type: type,
        status: 0
      })
    }
    catch (error) {
      logger.error('error in notification create', error.message);
      console.log("Error in notification create", error.message);
    }
  }
}
module.exports = notifications