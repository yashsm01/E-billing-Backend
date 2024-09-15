//Libraries
const v = require("node-input-validator");
const uuid = require("uuid");

// Middlewares
const parseValidate = require('../../middleware/parseValidate')
const logger = require("../../helpers/logger");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const moment = require('moment');

// Models
const DynamicModels = require('../../models/dynamic_models')
const ProductModel = require("../../models").products;
const ProductionOrderModel = require("../../models").production_orders;
const ProductBatchModel = require('../../models').product_batches;
const MappingTransactionModel = require('../../models').mapping_transactions;
const LocationModel = require('../../models/').locations;
const TransactionScannedModel = require('../../models/').transaction_scanned_info
const StorageBinModel = require('../../models/').storage_bins
const DynamicUIDModel = require('../../models/').dynamic_uids;
const StockSummary = require('../../models/').stock_summary;
const ReplacementHistory = require('../../models/').replacement_history;
const DynamicLevelCodesModel = require('../../models/').dynamic_level_codes;
const CompanyUser = require('../../models/').company_users;
const XCompanyCodes = require('../../models/').x_company_codes;
const models = require("./../_models");

//Controllers
const commonController = require('../common');
const qrcodeController = require('../../controllers/qr-codes-controller')

// These type of imports creates circular dependency please be careful while using or remove

// Global Last code to avoid duplicacy
let lastCode;
let lastOtherCode;
let TRCompleteInProgress = false;
let OtherTRCompleteInProgress = false;

/**
* @owner Kapil Kahar
* @description Mapping Controller
*/

module.exports = {
  getCodeDetails: async (req, res) => {
    try {
      let validator = new v(req.query, {
        code: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      let code = req.query.code;
      let { key, uniqueCode, UID, level } = await varifyCodes(code);
      if (key == null) {
        return res.status(200).send({ success: 0, message: 'Invalid Code Found' });
      }
      let key1 = await getLevelCode(key);
      console.log(">>>>>>>>uniqueCode.length ", uniqueCode.length);
      if (![13, 12].includes(uniqueCode.length)) {
        console.log("-------------Must Be Of 10/11 Characters");
        return res.status(200).send({ success: 0, message: "Invalid Code" })
      }

      // let level;
      if (uniqueCode.length == 13) {
        // let dynamicCode = uniqueCode[2] + uniqueCode[6] + uniqueCode[8];
        // let dynamicUID = await models.dynaminUidsModel.findOne({
        //   where: {
        //     code: dynamicCode
        //   },
        //   raw: true
        // })

        // if (!dynamicUID) {
        //   console.log("-------------Dynamic UID Not Found");
        //   return res.status(200).send({ success: 0, message: "Invalid Code" })
        // }
        // let dynamicLevel = await models.dynamicLevelModel.findOne({
        //   where: {
        //     code: uniqueCode[4],
        //     level: {
        //       [Op.ne]: null
        //     }
        //   },
        //   raw: true
        // })

        // if (!dynamicLevel) {
        //   console.log("-------------,Level Not Found");
        //   return res.status(200).send({ success: 0, message: "Invalid Code" })
        // }
        // UID = dynamicUID.u_id
        // level = dynamicLevel.level
      }
      else if (uniqueCode.length == 12) {
        console.log("Unique Code::", uniqueCode);
        let xCodeDetails = await XCompanyCodes.findOne({
          where: {
            unique_code: uniqueCode
          },
          raw: true
        })

        if (!xCodeDetails) {
          return false;
        }

        UID = xCodeDetails.u_id;
        level = xCodeDetails.level
      }



      let productInfo = await models.productsModel.findOne({
        where: {
          u_id: UID
        },
        raw: true
      })

      if (!productInfo) {
        return res.status(200).send({ success: 0, message: "Product Info Not Found" })
      }



      let isGeneral = productInfo.is_general;

      let CustomModel = await getDynamicModel(level, productInfo.u_id);

      if (!CustomModel) {
        return res.status(200).send({ success: 0, message: 'Dynamic Model Not Found' })
      }


      CustomModel.hasOne(MappingTransactionModel, {
        foreignKey: 'id',
        sourceKey: 'mapp_transaction_id',
        as: 'transaction'
      })

      CustomModel.hasOne(MappingTransactionModel, {
        foreignKey: 'id',
        sourceKey: 'transaction_id',
        as: 'mapping_transaction'
      })

      CustomModel.hasOne(CompanyUser, {
        foreignKey: 'id',
        sourceKey: 'replaced_by',
        as: 'replaced_by_user'
      })

      CustomModel.hasOne(ProductionOrderModel, {
        foreignKey: 'id',
        sourceKey: 'po_id'
      })

      models.productsModel.hasOne(models.customerCareModel, {
        foreignKey: 'id',
        sourceKey: 'marketed_by'
      })

      let codeFound = await CustomModel.findOne({
        where: {
          unique_code: uniqueCode
        },
        include: [
          {
            model: models.productsModel,
            as: 'product',
            raw: true,
            include: [{
              model: models.customerCareModel,
              as: 'customer_care',
              raw: true
            }]
          },
          {
            model: models.productsModel,
            as: 'assigned_product',
            raw: true,
          },
          {
            model: models.productionOrdersModel,
            raw: true
          },

          {
            model: models.ProductBatchModel,
            as: 'product_batch',
            raw: true,
          },
          {
            model: models.ProductBatchModel,
            as: 'assigned_batch',
            raw: true,
          },

          {
            model: models.mappingTransactionModel,
            raw: true,
            as: 'mapping_transaction'
          },
          {
            model: models.mappingTransactionModel,
            raw: true,
            as: 'transaction'
          },
          {
            model: models.CompanyUserModel,
            raw: true,
            as: 'replaced_by_user'
          }

        ],
        raw: true,
        nest: true
      })

      if (!codeFound) {
        return res.status(200).send({ success: 0, message: `Code not found` })
      }
      let locationDetails;
      if (codeFound.product_batch.location_id != null) {
        locationDetails = await models.locationModel.findOne({ where: { id: codeFound.product_batch.location_id }, raw: true })
      }
      // console.log("---------Code Found::", codeFound);


      let codeLevel = level;

      let UIDMrp = '-';

      let caseMRP = !isGeneral ? codeFound.product_batch.mrp : codeFound.assigned_batch.mrp;
      console.log("Case MRP::", caseMRP);
      if (caseMRP) {
        let masterInfo = !isGeneral ? codeFound.product_batch : codeFound.assigned_batch
        let mrpData = await qrcodeController.getCalculatedMRP(masterInfo, caseMRP);
        console.log("---Mrp Calculated", mrpData);

        let varName = codeLevel.toLowerCase() + 'MRP';
        UIDMrp = mrpData[varName];
      }

      let mappingType = '-';
      let replacedFrom = '-'
      let replacedBy = '-'
      if (codeFound.is_replaced) {
        mappingType = 'Replaced';
        replacedBy = codeFound.replaced_with;
        // replacedBy = codeFound.replaced_by_user.name;

      } else if (codeFound.transaction_id || codeFound.mapp_transaction_id) {
        if (codeFound.transaction.is_other || codeFound.mapping_transaction.is_other) {
          mappingType = 'NonQR-QR';
        }
        else {
          mappingType = 'Mapped';
        }
      } else if (codeFound.is_mapped || codeFound.is_complete) {
        mappingType = 'Mapped';
      }


      let parent = [];
      let childs = []

      if (!codeFound.is_replaced) {
        if (codeFound.is_mapped) {
          let masterInfo = !isGeneral ? codeFound.product_batch : codeFound.assigned_batch;
          let ParentLvl = await parentLvl(codeLevel, masterInfo);
          // let ParentLvl = codeFound.parent_level;
          if (ParentLvl != null) {
            let ParentModel = await getDynamicModel(ParentLvl, !isGeneral ? codeFound.product.u_id : codeFound.assigned_product.u_id);
            if (!ParentModel) {
              console.log('Dynamic Parent Model Not Found');
              // return res.status(200).send({ success: 0, message: 'Dynamic Parent Model Not Found' })
            }
            else {
              let parentCode = await ParentModel.findOne({
                where: {
                  id: codeFound.mapped_to_parent
                },
                raw: true
              })
              if (!parentCode) {
                return res.status(200).send({ success: 0, message: 'Parent Code Not Found' })
              }
              parent.push({ unique_code: parentCode.unique_code, qr_code: parentCode.qr_code })
            }
          }

        }

        if (codeFound.is_complete || true) {
          let innerLevel;
          // let currentProductInfo = !isGeneral ? codeFound.product : codeFound.assigned_product;
          let masterInfo = !isGeneral ? codeFound.product_batch : codeFound.assigned_batch;
          // console.log(">>>>>>>>>>>>>>>>masterInfo", masterInfo);
          if (codeLevel == 'S') {
            if (masterInfo.is_mapp_primary) {
              innerLevel = 'P';
            }
          }
          else if (codeLevel == 'T') {
            if (masterInfo.is_mapp_secondary) {
              innerLevel = 'S';
            }
            else if (masterInfo.is_mapp_primary) {
              innerLevel = 'P'
            }
          }
          else if (codeLevel == 'O') {
            if (masterInfo.is_mapp_tertiary) {
              innerLevel = 'T';
            } else if (masterInfo.is_mapp_secondary) {
              innerLevel = 'S';
            } else if (masterInfo.is_mapp_primary) {
              innerLevel = 'P';
            }
          }

          if (innerLevel) {
            let ChildModel, GeneralChildModel;
            ChildModel = await getDynamicModel(innerLevel, codeFound.product.u_id);

            if (!isGeneral) {
              console.log("--------------------General Product Found----------------");
            }
            else {   // General code
              GeneralChildModel = await getDynamicModel(innerLevel, codeFound.assigned_product.u_id);
              // ChildModel = await getDynamicModel(innerLevel, codeFound.assigned_product?.u_id);   // UID of asssigned product
            }
            if (!ChildModel) {
              return res.status(200).send({ success: 0, message: `Child Model (${!ChildModel ? 'Specific' : 'General'}) Not Found` })
            }

            // Updating parents of specific children
            let childCodes = await ChildModel.findAll({
              where: {
                is_replaced: false,
                mapped_to_parent: codeFound.id    // Previous Parent 
              },
              raw: true
            })
            let generalChildCodes = [];
            // Updating parents of general children
            if (isGeneral) {
              generalChildCodes = await GeneralChildModel.findAll({
                where: {
                  is_replaced: false,
                  mapped_to_parent: codeFound.id    // Previous Parent 
                },
                raw: true
              })
            }

            let allChilds = [...childCodes, ...generalChildCodes];

            allChilds.forEach(element => {
              childs.push({ unique_code: element.unique_code, qr_code: element.qr_code })
            });
          }
          else {
            console.log("----------Inner Level Not Found------------");
          }
        }
      }


      let mfgDate = !isGeneral ? codeFound.product_batch.mfg_date : codeFound.assigned_batch.mfg_date
      if (mfgDate) {
        mfgDate = moment(new Date(mfgDate)).format('DD/MMM/YYYY').toUpperCase();
      }

      let expDate = !isGeneral ? codeFound.product_batch.exp_date : codeFound.assigned_batch.exp_date
      if (expDate) {
        expDate = moment(new Date(expDate)).format('DD/MMM/YYYY').toUpperCase();
      }

      let data = [
        `Code Type : ${isGeneral ? 'General' : codeFound.is_open ? 'Open' : 'Specific'}`,
        `PO Details : ${!isGeneral && !codeFound.is_open ? codeFound.production_order.po_number : ''}`,
        `Item Code : ${!isGeneral ? codeFound.product.sku : codeFound.assigned_product.sku}`,
        `Item Name : ${!isGeneral ? codeFound.product.name : codeFound.assigned_product.name}`,
        `Batch No : ${!isGeneral ? codeFound.product_batch.batch_no : codeFound.assigned_batch.batch_no}`,
        `Mfg. Date : ${mfgDate}`,
        `Exp. Date : ${expDate}`,
        `MRP of UID : ${UIDMrp}`,
        `Date Of Generation : ${moment(new Date(codeFound.createdAt)).format('DD/MMM/YYYY').toUpperCase()}`,
        `Mapping Type : ${mappingType}`,
        `Replaced By : ${replacedBy}`,
        `Replaced From : ${codeFound.replaced_from ? codeFound.replaced_from : ''}`,
      ]
      let lvlName = {
        'O': "Outer",
        'T': "Tertiary",
        'S': "Secondary",
        'P': "Primary"
      }
      let obj = {
        level: lvlName[level],
        code: codeFound,
        locationDetails: locationDetails,
        details: data,
        parent: parent,
        child: childs
      }

      return res.status(200).send({ success: 1, data: obj, message: "" })
    }
    catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: "Internal Server Error" });
    }


  }
};


async function getDynamicModel(key, UID) {
  try {
    console.log("-------key", key);
    let CustomModel;
    switch (key) {
      case 'P':
        CustomModel = await DynamicModels.getPrimaryQRCodesModel(UID.toLowerCase());
        break;
      case 'S':
        CustomModel = await DynamicModels.getSecondaryQRCodesModel(UID.toLowerCase());
        break;
      case 'T':
        CustomModel = await DynamicModels.getTertiaryQRCodesModel(UID.toLowerCase());
        break;
      case 'O':
        CustomModel = await DynamicModels.getOuterQRCodesModel(UID.toLowerCase());
        break;
      default:
        console.log("---Invalid Level----", new Date());
        break;
    }
    return CustomModel;
  } catch (error) {
    console.log(error);
  }
}

async function splitCode(code) {
  try {
    let split1 = code.split('?')
    console.log("----Split1::", split1);

    let split2 = split1[1].split('~')
    console.log("----Split2::", split2);

    let level = split2[1].split(':')[1]
    console.log("----Level::", level);
    let uniqueCode = split2[2].split(':')[1]
    console.log("----Unique Code::", uniqueCode);
    let batch = split2[3].split(':')[1]
    console.log("----Batch::", batch);

    return {
      uniqueCode: uniqueCode,
      batch: batch,
      level: level
    }

  } catch (error) {
    console.log(error);
    return false
  }
}

async function getLevelCode(level) {
  return (level == 1 ? 'P' : level == 2 ? 'S' : level == 3 ? 'O' : 'T')
}

async function getCodeUID(code) {
  try {
    let dynamicUID = code[2] + code[6] + code[8];
    console.log("----Dynamic UID::", dynamicUID);
    let UIDInfo = await DynamicUIDModel.findOne({
      where: {
        code: dynamicUID
      },
      raw: true
    })
    if (UIDInfo) {
      console.log("----UID Found::", UIDInfo.u_id);
      return UIDInfo.u_id
    }
    else {
      console.log("----UID Not Found::");
      return false
    }
  } catch (error) {
    console.log(error);
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function getLastParent(masterInfo) {
  try {
    let lastParent;
    if (masterInfo.is_mapp_outer) {
      lastParent = 'O'
    }
    else if (masterInfo.is_mapp_tertiary) {
      lastParent = 'T'
    }
    else if (masterInfo.is_mapp_secondary) {
      lastParent = 'S'
    }

    return lastParent;

  } catch (error) {
    console.log(error);
    return false;
  }
}

async function getUIDAndLevel(code, sku = null) {
  let UID, level;
  let dynamicCode = code[2] + code[6] + code[8];
  let dynamicUID;
  if (sku == null) {
    dynamicUID = await DynamicUIDModel.findOne({
      where: {
        code: dynamicCode
      },
      raw: true
    })
  } else {
    dynamicUID = await models.productsModel.findOne({ where: { [Op.or]: [{ sku: sku }, { gtin: sku }] }, raw: true });
  }
  if (!dynamicUID) {
    console.log("-------------Dynamic UID Not Found");
  } else {
    UID = dynamicUID.u_id
  }

  let dynamicLevel = await DynamicLevelCodesModel.findOne({
    where: {
      code: code[4],
      level: {
        [Op.ne]: null
      }
    },
    raw: true
  })
  console.log("dyanmic Level::", code[4], dynamicLevel);
  if (!dynamicLevel) {
    console.log("-------------,Level Not Found");
  } else {
    level = dynamicLevel.level
  }

  return {
    UID: UID,
    level: level
  }
}


async function varifyCodes(code) {
  try {
    let key;
    let uniqueCode;
    let UID;
    let type = models.config.codeType;
    // let codeUrl = models.config.codeUrl;
    if (code.length > 13) {
      code = code.replace('http://', '');
      code = code.replace('https://', '');
      code = code.replace('HTTP://', '');
      code = code.replace('HTTPS://', '');
      let split1 = code.split('/');
      let split2 = split1[6].split('?');
      let sku = split1[2];
      let values = await getUIDAndLevel(split2[0], sku);
      UID = values.UID;
      key = values.level == 'P' ? 1 : values.level == 'S' ? 2 : values.level == 'O' ? 3 : 4;
      uniqueCode = split2[0];
      level = values.level;
    }
    else if (code.length == 12) {
      uniqueCode = code;
      console.log("Unique Code::", uniqueCode);
      let xCodeDetails = await XCompanyCodes.findOne({
        where: {
          unique_code: uniqueCode
        },
        raw: true
      })

      if (!xCodeDetails) {
        return false;
      }

      UID = xCodeDetails.u_id;
      key = xCodeDetails.level == 'P' ? 1 : xCodeDetails.level == 'S' ? 2 : xCodeDetails.level == 'O' ? 3 : 4;
      level = values.level;
    }
    else {
      let values = await getUIDAndLevel(code);
      UID = values.UID;
      key = values.level == 'P' ? 1 : values.level == 'S' ? 2 : values.level == 'O' ? 3 : 4;
      uniqueCode = code;
      level = values.level;
    }

    return { key, uniqueCode, UID, level }
  }
  catch (error) {
    return { key: null, uniqueCode: '' }
  }
}

async function parentLvl(codeLevel, masterInfo) {
  let outerLevel = null;
  if (codeLevel == 'P') {
    if (masterInfo.is_mapp_secondary) {
      outerLevel = 'S';
    }
    else if (masterInfo.is_mapp_tertiary) {
      outerLevel = 'T';
    }
    else {
      outerLevel = 'O';
    }
  }
  else if (codeLevel == 'S') {
    if (masterInfo.is_mapp_tertiary) {
      outerLevel = 'T';
    }
    else {
      outerLevel = 'O';
    }
  }
  else if (codeLevel == 'T') {
    outerLevel = 'O';
  }
  else if (codeLevel == 'O') {
    outerLevel = null;
  }
  return outerLevel;
};
