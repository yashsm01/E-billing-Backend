const v = require("node-input-validator");
const uuid = require("uuid");
const Sequelize = require('sequelize');
const randomstring = require("randomstring");

const Op = Sequelize.Op;

// models
let models = require("./_models");
// controller
// const controllers = require("./_controller");

let codeGenerationLimit = 10000;  //generate 10000 per day
const qrCodeController = {
  checkOrGenerateCodes: async () => {
    let count = await models.qrcodeBankModel.count({
      where: {
        is_consumed: false,
      },
      attribute: ['unique_code']
    });
    if (count < global.config.qrCodeLimit) {
      await qrCodeController.generateQrCodes();
      return;
    }

  },
  generateQrCodes: async () => {
    try {
      let uniqueCodes = [];
      let totalCodes = global.config.qrCodeLimit;

      let allowToGenerate = await models.controlPanelModel.findOne({
        where: {
          feature: 'Generate',
          status: true
        },
        raw: true
      })
      console.log("Generation Control Panel::", allowToGenerate);
      if (!allowToGenerate) {
        console.log("************----------Code Generation is stopped from control panel.---------**********");
        return;
      }
      console.log("-----------Generation On From control Panel--------");

      for (let index = 0; index < totalCodes; index++) {
        // Excluding: 0,1,5,8,B,I,O,Q,S
        let unique_string = randomstring.generate({ charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', length: 7, capitalization: 'uppercase' });
        // console.log("----", unique_string);

        let innerCode = {
          id: uuid.v4(),
          unique_code: unique_string
        };

        uniqueCodes.push(innerCode);

        if ((index != 0 && (index + 1) % 2500 == 0)) {
          console.log("-----Inserting", uniqueCodes.length);
          let bulkResponse = await models.qrcodeBankModel.bulkCreate(uniqueCodes, {
            ignoreDuplicates: true,
            returning: true
          })
          // console.log("returning::", bulkResponse);
          uniqueCodes.length = 0;
        }
      }

      if (uniqueCodes.length > 0) {
        let bulkResponse = await models.qrcodeBankModel.bulkCreate(uniqueCodes, {
          ignoreDuplicates: true,
          returning: true
        });
      }
      console.log("----Unique Codes added to bank successfully----", new Date());
    } catch (error) {
      console.log(error);
    }
  },
  getQrCodes: async (code = 1) => {
    try {
      await sleep(50);
      let uniqueCodes = await models.qrcodeBankModel.findAll({
        where: {
          is_consumed: false,
        },
        attribute: ['unique_code'],
        limit: code
      });
      if (uniqueCodes.length == 0) {
        qrCodeController.generateQrCodes();
        return { success: 0, message: "No Codes Available... Try again after minute" }
      }

      uniqueCodes = uniqueCodes.map(x => x.unique_code);
      await models.qrcodeBankModel.update({
        is_consumed: true,
      }, {
        where: {
          unique_code: {
            [Op.in]: uniqueCodes
          },
          is_consumed: false,
        }
      });

      return { success: 1, data: uniqueCodes };
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  }
}

module.exports = qrCodeController;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}