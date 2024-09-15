const msg = require('../i18n/en');
const APIConf = require('../config/api-configuration');
const FeatureMasterModel = require('../models/').feature_masters;
const FeatureAccessModel = require('../models/').feature_access
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

module.exports = async (req, res, next) => {
    try {
        console.log('URL ----', req.url)
        let url = req.url.toString().split('?')[0]
        console.log('URL :::::::', url)
        console.log('req url-->', (APIConf[url] ? APIConf[url][req.method] : "not found"));
        let apiDetails = APIConf[url] ? APIConf[url][req.method] : false;
        console.log('apidetails -->', apiDetails);
        if (apiDetails) {
            console.log('--')
            let featureMasterResp = await FeatureMasterModel.findAll({
                where: {
                    name: { [Op.in]: apiDetails.feature }
                }, raw: true, attributes: ['id']
            });

            if (featureMasterResp.length > 0) {
                let fIds = featureMasterResp.map(item => { return item.id; });
                let whereClause = {
                    feature_id: {
                        [Op.in]: fIds
                    },
                    user_id: req.userId
                };

                if (apiDetails.access === 0) {
                    whereClause.can_read = true;
                } else if (apiDetails.access === 1) {
                    whereClause.can_write = true;
                } else if (apiDetails.access === 2) {
                    whereClause.can_update = true;
                } else {
                    whereClause.can_delete = true;
                }

                let featureAccessResp = await FeatureAccessModel.findAll({
                    where: whereClause, raw: true
                });

                if (featureAccessResp.length > 0) {
                    next();
                } else {
                    return res.status(401).send({ success: 0, message: msg.unauthorizedAccess });
                }
            } else {
                return res.status(401).send({ success: 0, message: msg.unauthorizedAccess });
            }
        } else {
            return res.status(401).send({ success: 0, message: msg.unauthorizedAccess });
        }
    } catch (e) {
       console.log('e: ', e);
       return res.status(401).send({ success: 0, message: msg.unauthorizedAccess });
    }
};
