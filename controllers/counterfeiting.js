const Product = require('../models').products;
const { Validator } = require("node-input-validator");
const CustomerProducts = require('../models').customer_products;
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const _ = require('lodash');
const moment = require('moment');
const logger = require('../helpers/logger');
const { log } = require('winston');
const DynamicModels = require('../models/dynamic_models');
const City = require('../models/').city;
const State = require('../models/').state;
const Products = require('../models/').products;
const CustomerModel = require('../models').consumers;
const CounterfitModel = require('../models/').counterfit;

const models = require("./_models");

const db = require('../models');

CounterfitModel.hasOne(models.productsModel, {
  foreignKey: 'id',
  sourceKey: 'product_id'
});


module.exports = {
  getProductResults: async (req, res) => {
    let results = await Product.findAll({
      attributes: ['id', 'name'],
    })
    return res.send({ success: 1, data: results });
  },

  sameCodeScannedInDiffLocation: async (req, res) => {
    try {
      console.log("in func >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", req.query);
      if (!req.query.duration) {
        return res.status(200).send({
          "success": "0",
          "message": 'Duration Required'
        });
      }
      let response = await getLocationOfSameCode(req.query.duration, req.query.productId, req.query.start, req.query.end);
      console.log(">>>>>>>response", response);
      return res.send({
        success: 1,
        data: response
      });
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: error.toString()
      });
    }
  },

  sameNumberScanMultipleCodes: async (req, res) => {
    try {
      if (!req.query.duration) {
        return res.status(200).send({
          "success": "0",
          "message": 'Duration Required'
        });
      }
      let data = await findScannedCodesInNearestLocation1(req.query.duration, req.query.productId, req.query.start, req.query.end);

      data = await _.orderBy(data, "createdAt", "asc");

      return res.send({
        success: 1,
        data: data
      });
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: error.toString()
      });
    }
  },
  multipleCodesScannedInSameLocation: async (req, res) => {
    try {
      if (!req.query.duration) {
        return res.status(200).send({
          "success": "0",
          "message": 'Duration Required'
        });
      }
      let data = await findScannedCodesInNearestLocation(req.query.duration, req.query.productId, req.query.start, req.query.end);

      data = await _.orderBy(data, "createdAt", "asc");

      return res.send({
        success: 1,
        data: data
      });
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: error.toString()
      });
    }
  },

  expCodesScannedFromAnyLoc: async (req, res) => {
    try {
      if (!req.query.duration) {
        return res.status(200).send({
          "success": "0",
          "message": 'Duration Required'
        });
      }

      // let conf = {}
      // if (req.query.duration == 'c') {
      //     conf = {
      //         start: 'required',
      //         end: 'required'
      //     }
      // }

      // let validator = new v(req.query, conf);

      // let matched = await validator.check();
      // if (!matched) {
      //     return res.status(200).send({
      //         "success": "0",
      //         "message": validator.errors
      //     });
      // }

      let data = await findExpCodesScannedFromAnyLocation(/*req.query.start, req.query.end,*/ req.query.duration, req.query.productId, req.query.start, req.query.end);
      console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>exp", data)
      return res.status(200).send({
        success: 1,
        data: data
      });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: error.toString()
      });
    }
  }
}

const getLocationOfSameCode = async (reqduration, productId = null, sDate, eDate) => {
  let duration = 2;
  let durationUnit = 'years';
  let minCount = 2;


  let { startDate, endDate } = await getStartEndDate(reqduration, sDate, eDate);

  let response = await CounterfitModel.findAll({
    where: {
      // product_id: productId,
      // type: 1,
      city_id: {
        [Op.ne]: null
      },
      createdAt: {
        [Op.gte]: startDate,
        [Op.lte]: endDate
      },
    },
    attributes: ['code_id', Sequelize.fn('count', Sequelize.col('id'))],
    group: ['code_id'],
    raw: true,
    nest: true
  });

  let filtered = response.filter(item => {
    return item.count >= minCount
  });

  let data = [];
  for (let i = 0; i < filtered.length; i++) {
    data = data.concat(await findCodeFromDiffLocation(filtered[i].code_id, productId, startDate, endDate, duration, durationUnit, minCount));
  }

  data = await _.orderBy(data, 'createdAt', 'desc');
  return data;
}

let getStartEndDate = async (duration, start, end) => {
  let startDate, endDate;

  switch (duration) {
    case '7d':
      startDate = moment(new Date()).subtract(7, 'days').format("YYYY-MM-DD") + " 00:00:00";
      endDate = moment(new Date()).format("YYYY-MM-DD") + " 23:59:59";
      break;
    case 'm':
      startDate = moment(new Date()).subtract(1, 'months').format("YYYY-MM-DD") + " 00:00:00";
      endDate = moment(new Date()).format("YYYY-MM-DD") + " 23:59:59";
      break;
    case 'y':
      startDate = moment(new Date()).subtract(1, 'years').format("YYYY-MM-DD") + " 00:00:00";
      endDate = moment(new Date()).format("YYYY-MM-DD") + " 23:59:59";
      break;
    default:
      startDate = moment(start, "YYYY-MM-DD").format("YYYY-MM-DD") + " 00:00:00";
      endDate = moment(end, "YYYY-MM-DD").format("YYYY-MM-DD") + " 23:59:59";
      break;
  }

  return {
    startDate: startDate,
    endDate: endDate
  };
}

const findCodeFromDiffLocation = async (codeId, productId, startDate, endDate, duration, durationUnit, limit) => {
  let data = await CounterfitModel.findAll({
    where: {
      // product_id: productId,
      role_id: 0,
      code_id: codeId,
      createdAt: {
        [Op.gte]: startDate,
        [Op.lte]: endDate
      }
    },
    include: [{
      model: City,
      attributes: ['id', 'name'],
      include: [
        {
          model: State,
          attributes: ['id', 'name'],
          as: 'state'
        }
      ]
    },
    {
      model: Products,
      attributes: ['id', 'name']
    }
    ],
    attributes: ['city_id', 'createdAt', 'code_id', 'unique_code', 'customer_id', 'id', 'latitude', 'longitude', 'product_id'],
    groupBy: ['city_id'],
    order: [
      ['createdAt', 'asc']
    ],
    raw: true,
    nest: true
  });

  //console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> dataout", data)

  let filteredData = [];
  let buffData = [];
  let maxDate;
  let cities = [];
  for (let j = 0; j < data.length; j++) {
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>> cities", cities)
    if (j == 0) {
      console.log(">>>>>>In IF");
      cities.push(data[j].city_id);
      buffData.push(data[j]);
      maxDate = moment(data[j].createdAt).add(duration, durationUnit).format('YYYY-MM-DD hh:mm:ss');
      console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>> cities", cities)
    } else {
      console.log(">>>>>>In Else");
      let createdAT = moment(data[j].createdAt).format('YYYY-MM-DD hh:mm:ss');
      if (createdAT <= maxDate && !cities.includes(data[j].city_id)) {
        buffData.push(data[j]);
        cities.push(data[j].city_id);
      } else {
        if (buffData.length >= limit) {
          filteredData = filteredData.concat(buffData);
        }
        buffData.length = 0;
        buffData.push(data[j]);
      }

      if (j == data.length - 1 && buffData.length >= limit) {
        filteredData = filteredData.concat(buffData);
      }

      maxDate = moment(data[j].createdAt).add(duration, durationUnit).format('YYYY-MM-DD hh:mm:ss');
    }
  }

  if (filteredData.length > 0) {
    for (let d = 0; d < filteredData.length; d++) {
      console.log(">>>>>>>>>>filteredData[d]", filteredData[d]);

      let customerInfo = await CustomerModel.findOne({
        where: {
          id: filteredData[d].customer_id
        },
        attributes: ['phone']
      });

      filteredData[d].phoneNumber = customerInfo.phone;
    }
  }

  console.log(">>>>filteredData", filteredData);
  return (filteredData.length == 0) ? [] : {
    createdAt: filteredData[filteredData.length - 1].createdAt,
    data: filteredData,
    code: filteredData[0].unique_code
  };
}

const getMostScannedCodesByNumber = async (reqduration, productId, sDate, eDate) => {
  let duration = 15;
  let durationUnit = 'days';
  let minCount = 1;

  let {
    startDate,
    endDate
  } = await getStartEndDate(reqduration, sDate, eDate);

  let historyData = await CustomerProducts.findAll({
    where: {
      product_id: productId,
      createdAt: {
        [Op.gte]: startDate,
        [Op.lte]: endDate
      },
      city_id: {
        [Op.ne]: null
      }
    },
    attributes: ['id', 'customer_id', 'product_id', 'latitude', 'longitude', 'createdAt', 'city_id', 'code'],
    include: [{
      model: Products,
      attributes: ['name']
    }, {
      model: City,
      attributes: ['name', 'latitude', 'longitude'],
      include: [{
        model: State,
        attributes: ['name']
      }]
    }],
    raw: true,
    nest: true
  });

  if (historyData.length == 0) {
    return [];
  }

  historyData = await _.orderBy(historyData, 'createdAt', 'asc');

  let groupedHistory = await _.groupBy(historyData, 'customer_id');

  let nearestData = {};
  let maxDate, item;
  let indexes = [];
  let buffIndex = [];
  for (let i = 0; i < Object.keys(groupedHistory).length; i++) {
    indexes.length = 0;
    buffIndex.length = 0;

    for (let j = 0; j < groupedHistory[Object.keys(groupedHistory)[i]].length; j++) {
      item = groupedHistory[Object.keys(groupedHistory)[i]][j];

      if (j == 0) {
        buffIndex.push(0);
      } else if (moment(item.createdAt) < maxDate) {

        buffIndex.push(j);

        if (buffIndex.length > minCount && j == groupedHistory[Object.keys(groupedHistory)[i]].length - 1) {
          indexes = indexes.concat(buffIndex);
          buffIndex.length = 0;
        }

      } else {

        if (buffIndex.length >= minCount) {
          indexes = indexes.concat(buffIndex);
        }

        buffIndex.length = 0;

        buffIndex.push(j);
      }
      maxDate = moment(item.createdAt).add(duration, durationUnit);
    }

    if (indexes.length > minCount) {
      let data = [];
      let customerDetails = null;
      for (let k = 0; k < indexes.length; k++) {

        let item = groupedHistory[Object.keys(groupedHistory)[i]][Number(indexes[k])];

        if (k == 0) {
          customerDetails = await CustomerModel.findOne({
            where: {
              id: item.customer_id
            },
            attributes: ['name', 'phone'],
            raw: true,
            nest: true
          });
        }

        item.customer = customerDetails;

        // codes.push(groupedHistory[Object.keys(groupedHistory)[i]][Number(indexes[k])]['trusted_qrcode.qrcode_role_id']);
        data.push(item);;
      }


      nearestData[data[0].customer.phone] = data;
    }
  }

  let formattedDataCitywise = {};
  let keys = Object.keys(nearestData);
  for (let s = 0; s < keys.length; s++) {
    let cityId = nearestData[keys[s]][0].city_id;
    if (formattedDataCitywise[cityId]) {
      if (formattedDataCitywise[cityId].data[keys[s]]) {
        formattedDataCitywise[cityId].data[keys[s]] = formattedDataCitywise[cityId].data[keys[s]].concat(nearestData[keys[s]]);
      } else {
        formattedDataCitywise[cityId].data[keys[s]] = nearestData[keys[s]];
      }
    } else {
      formattedDataCitywise[cityId] = {
        latitude: nearestData[keys[s]][0].city.latitude,
        longitude: nearestData[keys[s]][0].city.longitude,
        data: {
          [keys[s]]: nearestData[keys[s]]
        }
      };
    }

  }
  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> format", formattedDataCitywise)

  return formattedDataCitywise;
};

const findScannedCodesInNearestLocation = async (reqduration, productId, sDate, eDate) => {
  let minCount = 2;
  let radius = 50; // in meter

  let {
    startDate,
    endDate
  } = await getStartEndDate(reqduration, sDate, eDate);
  let groupedCityData = await CounterfitModel.findAll({
    where: {
      // product_id: productId,
      // type: 2,
      city_id: {
        [Op.ne]: null
      },
      createdAt: {
        [Op.gte]: startDate,
        [Op.lte]: endDate
      },
    },
    // attributes: ['code_id', Sequelize.fn('count', Sequelize.col('id'))],
    attributes: ['city_id', 'unique_code', Sequelize.fn('count', Sequelize.col('id'))],
    // group: ['code_id'],
    group: ['city_id', 'unique_code'],

    raw: true,
    nest: true
  });

  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> data-pre", groupedCityData)

  let filtered = groupedCityData.filter(item => {
    return item.count >= minCount
  });

  let data = [];
  let tempDetails;
  for (let i = 0; i < filtered.length; i++) {
    tempDetails = await getCodesFromSameLocation(filtered[i], productId, /*duration, durationUnit,*/ minCount, radius, startDate, endDate);
    if (tempDetails != 0)
      data = data.concat(tempDetails);
  }

  data = await _.orderBy(data, 'createdAt', 'desc');

  // for (let s = 0; s < data.length; s++) {
  //     for (let d = 0; d < data[s].data.length; d++) {
  //         if (tmp[data[s].data[d].qrcode_role_id] == null) {
  //             let code = await QRCodeShortCode.findOne({
  //                 where: {
  //                     sub_code: data[s].data[d].qrcode_role_id
  //                 },
  //                 attributes: ['shortcode']
  //             });

  //             code = 'AA' + code.shortcode;
  //             data[s].data[d].code = code;
  //             tmp[data[s].data[d].qrcode_role_id] = code;
  //         } else {
  //             data[s].data[d].code = tmp[data[s].data[d].qrcode_role_id];
  //         }
  //     }
  // }

  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> out 1", data)
  return data;
}

const findScannedCodesInNearestLocation1 = async (reqduration, productId, sDate, eDate) => {
  let minCount = 2;
  let radius = 50; // in meter

  let {
    startDate,
    endDate
  } = await getStartEndDate(reqduration, sDate, eDate);
  let groupedCityData = [];

  let duration = {
    'w': 'weekly',
    'm': 'monthly',
    'y': 'yearly',
    'd': 'daily',
    'c': 'daily'
  }

  let tableListQuery = `SELECT table_name FROM information_schema.tables WHERE table_name like 'customer_products_%'`;
  let availableTable = await querySQl(tableListQuery);

  let tableList = availableTable.map(x => {
    return x.substr(x.length - 5);
  })
  let responseList = [];

  for (let i = 0; i < tableList.length; i++) {
    const element = tableList[i];
    let customerProductScheme = await DynamicModels.getCustomerProductsModel(element);
    let response = await customerProductScheme.findAll({
      where: {
        // product_id: productId,
        // type: 1,
        city_id: {
          [Op.ne]: null
        },
        createdAt: {
          [Op.gte]: startDate,
          [Op.lte]: endDate
        },
      },
      // attributes: ['code_id', Sequelize.fn('count', Sequelize.col('id'))],
      attributes: ['customer_id', Sequelize.fn('count', Sequelize.col('id'))],
      // group: ['code_id'],
      group: ['customer_id'],

      raw: true,
      nest: true
    });
    let responses = response.map(x => { return { uids: element, ...x } })
    responseList.push(...responses);

  }

  groupedCityData = responseList;

  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> data-pre", groupedCityData)

  let filtered = groupedCityData.filter(item => {
    return item.count >= minCount
  });

  let data = [];
  let tempDetails;
  for (let i = 0; i < filtered.length; i++) {
    tempDetails = await getCodesFromDifferentLocation(filtered[i], productId, /*duration, durationUnit,*/ minCount, radius, startDate, endDate);
    if (tempDetails != 0)
      data = data.concat(tempDetails);
  }

  data = await _.orderBy(data, 'createdAt', 'desc');

  // for (let s = 0; s < data.length; s++) {
  //     for (let d = 0; d < data[s].data.length; d++) {
  //         if (tmp[data[s].data[d].qrcode_role_id] == null) {
  //             let code = await QRCodeShortCode.findOne({
  //                 where: {
  //                     sub_code: data[s].data[d].qrcode_role_id
  //                 },
  //                 attributes: ['shortcode']
  //             });

  //             code = 'AA' + code.shortcode;
  //             data[s].data[d].code = code;
  //             tmp[data[s].data[d].qrcode_role_id] = code;
  //         } else {
  //             data[s].data[d].code = tmp[data[s].data[d].qrcode_role_id];
  //         }
  //     }
  // }

  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> out 1", data)
  return data;
}

const getCodesFromSameLocation = async (cityGrouped, productId, /*duration, durationUnit,*/ minCount, radius, startDate, endDate) => {
  let scannedDetails = await CounterfitModel.findAll({
    where: {
      // product_id: productId,
      role_id: 0,
      city_id: cityGrouped.city_id,
      createdAt: {
        [Op.gte]: startDate,
        [Op.lte]: endDate
      },
      // store_lat: null,
      // store_lng: null
    },
    include: [{
      model: City,
      attributes: ['id', 'name'],
      include: [{
        model: State,
        attributes: ['id', 'name'],
        as: 'state'
      }]
    },
    {
      model: Products,
      attributes: ['id', 'name']
    }
    ],
    attributes: ['city_id', 'createdAt', 'code_id',
      'customer_id', 'id', 'latitude', 'longitude', 'unique_code'
    ],
    order: [
      ['createdAt', 'asc']
    ],
    raw: true,
    nest: true
  });

  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> req data", scannedDetails)

  let buff = [];
  let filtered = [];
  let /*maxDate,*/ meterDiff;
  let preLatLng = {
    lat: undefined,
    lng: undefined
  }
  let currentTime, currentLat, currentLng;

  for (let i = 0; i < scannedDetails.length; i++) {
    currentLat = scannedDetails[i].latitude;
    currentLng = scannedDetails[i].longitude;

    if (i == 0) {
      buff.push(scannedDetails[i]);
      //maxDate = moment(scannedDetails[i].createdAt).add(duration, durationUnit)
      preLatLng.lat = scannedDetails[i].latitude;
      preLatLng.lng = scannedDetails[i].longitude;
    } else {
      // console.log(preLatLng.lat, preLatLng.lng, currentLat, currentLng)
      meterDiff = await calculateDistance(preLatLng.lat, preLatLng.lng, currentLat, currentLng);
      if (Number(meterDiff) <= radius) {
        //console.log('yes')
        buff.push(scannedDetails[i]);

        if (i == scannedDetails.length - 1 && buff.length >= minCount) {
          filtered = filtered.concat(buff);
          buff.length = 0;
        }
      } else {
        if (buff.length >= minCount) {
          filtered = filtered.concat(buff);
        }
        buff.length = 0;

        buff.push(scannedDetails[i]);
        //}
      }
      // else {
      //     // console.log('else', buff.length, minCount);
      //     if (buff.length >= minCount) {
      //         filtered = filtered.concat(buff);
      //     }
      //     buff.length = 0;

      //     buff.push(scannedDetails[i]);
      // }
      //maxDate = moment(scannedDetails[i].createdAt).add(duration, durationUnit)
      preLatLng.lat = scannedDetails[i].latitude;
      preLatLng.lng = scannedDetails[i].longitude;
    }
  }

  if (filtered.length > 0) {

    let tmp = {};
    for (let d = 0; d < filtered.length; d++) {
      if (tmp[filtered[d].customer_id] == null) {

        let customerInfo = await CustomerModel.findOne({
          where: {
            id: filtered[d].customer_id
          },
          attributes: ['phone']
        });

        filtered[d].phone = customerInfo.phone;
        tmp[filtered[d].customer_id] = customerInfo.phone;
      } else {
        filtered[d].phone = tmp[filtered[d].customer_id];
      }
    }
  }

  return (filtered.length == 0) ? 0 : {
    createdAt: filtered[filtered.length - 1].createdAt,
    cityId: cityGrouped.city_id,
    cityName: filtered[0].city.name,
    data: filtered
  };
}

const getCodesFromDifferentLocation = async (cityGrouped, productId, /*duration, durationUnit,*/ minCount, radius, startDate, endDate) => {
  let customerProductScheme = await DynamicModels.getCustomerProductsModel(cityGrouped.uids);
  customerProductScheme.hasOne(models.cityModel, {
    foreignKey: 'id',
    sourceKey: 'city_id'
  });

  customerProductScheme.hasOne(models.productsModel, {
    foreignKey: 'id',
    sourceKey: 'product_id'
  });
  customerProductScheme.hasMany(models.ConsumersModel, {
    foreignKey: 'id',
    sourceKey: 'customer_id'
  });
  customerProductScheme.hasMany(models.ChannelPartners, {
    foreignKey: 'id',
    sourceKey: 'customer_id'
  });
  let scannedDetails = await customerProductScheme.findAll({
    where: {
      // product_id: productId,
      // role_id: 0,
      // city_id: cityGrouped.city_id,
      customer_id: cityGrouped.customer_id,
      createdAt: {
        [Op.gte]: startDate,
        [Op.lte]: endDate
      },
      // store_lat: null,
      // store_lng: null
    },
    include: [{
      model: City,
      attributes: ['id', 'name'],
      include: [{
        model: State,
        attributes: ['id', 'name'],
        as: 'state'
      }]
    },
    {
      model: models.productsModel,
      attributes: ['id', 'name']
    }, {
      model: models.ConsumersModel,
      attributes: ['phone'],
    }, {
      model: models.ChannelPartners,
      attributes: ['phone'],
    }
    ],
    attributes: ['city_id', 'createdAt', 'code_id',
      'customer_id', 'id', 'latitude', 'longitude', 'unique_code'
    ],
    order: [
      ['createdAt', 'asc']
    ],
    raw: true,
    nest: true
  });

  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> req data", scannedDetails)

  let buff = [];
  let filtered = scannedDetails;
  let /*maxDate,*/ meterDiff;
  let preLatLng = {
    lat: undefined,
    lng: undefined
  }
  let currentTime, currentLat, currentLng;

  for (let i = 0; i < scannedDetails.length; i++) {
    currentLat = scannedDetails[i].latitude;
    currentLng = scannedDetails[i].longitude;
    currentTime = moment(scannedDetails[i].createdAt)

    if (i == 0) {
      buff.push(scannedDetails[i]);
      //maxDate = moment(scannedDetails[i].createdAt).add(duration, durationUnit)
      preLatLng.lat = scannedDetails[i].latitude;
      preLatLng.lng = scannedDetails[i].longitude;
    } else {
      // console.log(preLatLng.lat, preLatLng.lng, currentLat, currentLng)
      meterDiff = await calculateDistance(preLatLng.lat, preLatLng.lng, currentLat, currentLng);
      //console.log('meter diff : ', meterDiff, currentTime, maxDate);
      // if (currentTime <= maxDate) {
      //console.log(true)
      if (Number(meterDiff) <= radius) {
        //console.log('yes')
        buff.push(scannedDetails[i]);

        if (i == scannedDetails.length - 1 && buff.length >= minCount) {
          filtered = filtered.concat(buff);
          buff.length = 0;
        }
      } else {
        if (buff.length >= minCount) {
          filtered = filtered.concat(buff);
        }
        buff.length = 0;

        buff.push(scannedDetails[i]);
        //}
      }
      // else {
      //     // console.log('else', buff.length, minCount);
      //     if (buff.length >= minCount) {
      //         filtered = filtered.concat(buff);
      //     }
      //     buff.length = 0;

      //     buff.push(scannedDetails[i]);
      // }
      //maxDate = moment(scannedDetails[i].createdAt).add(duration, durationUnit)
      preLatLng.lat = scannedDetails[i].latitude;
      preLatLng.lng = scannedDetails[i].longitude;
    }
  }


  if (filtered.length > 0) {

    let tmp = {};
    for (let d = 0; d < filtered.length; d++) {
      //console.log('***', filtered[d]);
      if (tmp[filtered[d].customer_id] == null) {


        //console.log('customer id: ', filtered[d].customer_id, customerInfo);

        filtered[d].phone = filtered[d]?.consumers?.phone == null ? filtered[d]?.channel_partners?.phone : filtered[d]?.consumers?.phone;
        tmp[filtered[d].customer_id] = filtered[d]?.consumers?.phone == null ? filtered[d]?.channel_partners?.phone : filtered[d]?.consumers?.phone;
      } else {
        filtered[d].phone = tmp[filtered[d].customer_id];
      }
    }
  }

  return (filtered.length == 0) ? 0 : {
    createdAt: filtered[filtered.length - 1].createdAt,
    cityId: filtered[0].city_id ?? '-',
    cityName: filtered[0].city.name,
    data: filtered
  };
}

async function calculateDistance(lat1, lon1, lat2, lon2) {
  let R = 6371; // km
  let dLat = toRad(lat2 - lat1);
  let dLon = toRad(lon2 - lon1);
  lat1 = toRad(lat1);
  lat2 = toRad(lat2);
  lon1 = toRad(lon1);
  lon2 = toRad(lon2);
  let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  let d = R * c;
  d = d * 1000;
  return d.toFixed(0);
}

function toRad(Value) {
  return Value * Math.PI / 180;
}

const findExpCodesScannedFromAnyLocation = async (reqduration, productId, sDate, eDate) => {

  let {
    startDate,
    endDate
  } = await getStartEndDate(reqduration, sDate, eDate);

  let duration = {
    'w': 'weekly',
    'm': 'monthly',
    'y': 'yearly',
    'd': 'daily',
    'c': 'daily'
  }

  let tableListQuery = `SELECT table_name FROM information_schema.tables WHERE table_name like 'customer_products_%'`;
  let availableTable = await querySQl(tableListQuery);

  let tableList = availableTable.map(x => {
    return x.substr(x.length - 5);
  })
  let responseList = [];
  for (let i = 0; i < tableList.length; i++) {
    const element = tableList[i];
    let customerProductScheme = await DynamicModels.getCustomerProductsModel(element);
    customerProductScheme.hasOne(models.cityModel, {
      foreignKey: 'id',
      sourceKey: 'city_id'
    });

    customerProductScheme.hasOne(models.productsModel, {
      foreignKey: 'id',
      sourceKey: 'product_id'
    });
    customerProductScheme.hasMany(models.ConsumersModel, {
      foreignKey: 'id',
      sourceKey: 'customer_id'
    });
    customerProductScheme.hasMany(models.ChannelPartners, {
      foreignKey: 'id',
      sourceKey: 'customer_id'
    });
    let response = await customerProductScheme.findAll({
      where: {
        // product_id: productId,
        city_id: {
          [Op.ne]: null
        },
        createdAt: {
          [Op.gte]: startDate,
          [Op.lte]: endDate
        },
        is_expired: true,
      },
      include: [{
        model: City,
        attributes: ['id', 'name'],
        include: [
          {
            model: State,
            attributes: ['id', 'name'],
            as: 'state'
          }
        ]
      }, {
        model: models.productsModel,
        attributes: ['id', 'name']
      }, {
        model: models.ConsumersModel,
        attributes: ['phone'],
      }, {
        model: models.ChannelPartners,
        attributes: ['phone'],
      }],
      // attributes: [Sequelize.fn('count', Sequelize.col('id'))],
      attributes: ['code_id', 'longitude', 'latitude', 'createdAt', 'city_id', 'unique_code'],
      raw: true,
      nest: true
    });
    responseList.push(...response)
  }
  return responseList;
}


//Date Duration filter
function generateFilteredDates(startDate, endDate, filter) {
  const filteredDates = [];
  const filterMonths = [];
  let currentDate = new Date(startDate);
  let endsDate = new Date(endDate);
  let currentMonth = new Date(startDate);
  while (currentMonth <= endDate || currentDate <= endDate) {
    if (currentDate <= endDate) {
      filteredDates.push({ date: new Date(currentDate), month: formatMMYY(currentDate) });
    }
    if (currentMonth <= endDate) {
      filterMonths.push(formatMMYY(currentMonth));
    }

    switch (filter) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        break;
      case 'yearly':
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        break;
      case 'custom':
        currentDate = endsDate.setDate(endsDate.getDate() + 1);
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        break;
      default:
        throw new Error('Invalid filter duration. Use "weekly", "monthly", or "yearly".');
    }
  }
  return { filteredDates, filterMonths };
}

function formatMMYY(date) {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${month}_${year}`;
}

//sql query function
async function querySQl(Condition) {
  const data = await db.sequelize.query(Condition, { type: db.Sequelize.QueryTypes.SELECT, raw: true });
  return data.flat();
}