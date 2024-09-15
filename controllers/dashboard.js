const v = require("node-input-validator");
const sequelize = require("sequelize");
const { Op, fn, col } = require("sequelize");
const db = require('../models');
const moment = require('moment');
const logger = require("../helpers/logger");
const parseValidate = require("../middleware/parseValidate");
const qrcodeController = require('../controllers/qr-codes-controller');
const DynamicModels = require('../models/dynamic_models');
const CounterfitModel = require('../models/').counterfit;

const models = require("./_models");

let exportLimit = 300000;

CounterfitModel.hasOne(models.ConsumersModel, {
  foreignKey: "id",
  sourceKey: "customer_id",
});

CounterfitModel.hasOne(models.ChannelPartners, {
  foreignKey: "id",
  sourceKey: "customer_id",
});

CounterfitModel.hasOne(models.cityModel, {
  foreignKey: "id",
  sourceKey: "city_id",
});

CounterfitModel.hasOne(models.locationModel, {
  foreignKey: 'id',
  sourceKey: 'location_id'
});

CounterfitModel.hasOne(models.productsModel, {
  foreignKey: 'id',
  sourceKey: 'product_id'
});

//NEW STOCK REPORT
let dashboard_report = {
  schemeBaseDoughnutDetails: async (req, res) => {
    try {
      let validator = new v(req.body, {
        id: "required",
        filterType: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let pointAllocationScheme = await models.pointAllocationModel.findOne({
        where: {
          id: req.body.id
        },
        raw: true
      });

      if (!pointAllocationScheme) {
        return res.status(200).send({ success: 0, message: "Scheme Detail Not Found" });
      }
      let start = req.body.start ?? '2023-01-10';
      let end = req.body.end ?? '2023-12-31';
      let filterType = req.body.filterType ?? 'w';
      //3 year Limit
      if (new Date(end).getTime() - new Date(end).getTime(start) > 1000 * 60 * 60 * 25 * 365 * 3) {
        return res.status(200).send({ success: 0, message: "Date Filter Limit Is 3 Years..." });
      }
      const currentDate = new Date();
      if (filterType == 'w') {
        start = moment(new Date().setDate(new Date().getDate() - 35)).format("YYYY-MM-DD");
        end = moment(new Date()).format("YYYY-MM-DD");
      } else if (filterType == 'm') {
        end = moment(new Date()).format("YYYY-MM-DD");
        start = moment(new Date().setMonth(new Date().getMonth() - 5)).format("YYYY-MM-DD");
      } else if (filterType == 'y') {
        end = moment(new Date()).format("YYYY-MM-DD");
        start = moment(new Date().setFullYear(new Date().getFullYear() - 4)).format("YYYY-MM-DD");
      } else if (filterType == 'c') {

      }

      let duration = {
        'w': 'weekly',
        'm': 'monthly',
        'y': 'yearly',
        'd': 'daily',
        'c': 'daily'
      }
      let filters = generateFilteredDates(new Date(start), new Date(end), duration[`${filterType}`]);
      let filteredDates = filters.filteredDates;
      let filterMonths = filters.filterMonths;

      //get Available customer_products_MM_YY Tables
      let tableListQuery = `SELECT table_name FROM information_schema.tables WHERE table_name like 'customer_products_%'`;

      // filterMonths.forEach(element => {
      //   tableListQuery += `'customer_products_${element}',`;
      // });
      // tableListQuery = tableListQuery.slice(0, -1);
      // tableListQuery += ')';

      let availableTable = await querySQl(tableListQuery);

      let tableList = availableTable.map(x => {
        return x.substr(x.length - 5);
      })
      let labels = [];
      let data = [];
      let total = 0;
      //get count Sku Wize 
      for (let j = 0; j < pointAllocationScheme.sku_id.length; j++) {
        const SKU = pointAllocationScheme.sku_id[j];
        let ProductDetail = await models.productsModel.findOne({
          where: {
            id: SKU
          },
          attributes: ['id', 'sku', 'name'],
          raw: true
        });
        let periodCount = 0;
        for (let y = 0; y < tableList.length; y++) {
          const element = tableList[y];
          let customerProductScheme = await DynamicModels.getCustomerProductsModel(element);
          let count = await customerProductScheme.count({
            where:
            {
              product_id: ProductDetail.id,
              scheme_id: { [Op.overlap]: [pointAllocationScheme.id] },
              [Op.and]: [
                { createdAt: { [Op.gte]: `${moment(start, "YYYY-MM-DD").format("YYYY-MM-DD")} 00:00:00` } },
                { createdAt: { [Op.lt]: `${moment(end, "YYYY-MM-DD").format("YYYY-MM-DD")} 23:59:59` } }
              ],
              // createdAt: {
              //   [Op.between]: [start, end],
              // },
            }
          });
          periodCount += count;
        }
        total += periodCount;
        labels.push(ProductDetail.sku);
        data.push(periodCount);
      }
      for (let index = 0; index < data.length; index++) {
        const element = data[index];
        let percentage = (element * 100) / total;
        labels[index] = `${labels[index]} - ${percentage > 0 ? percentage.toFixed(2) : 0}%`
      }
      let doughnutChartData = {
        labels: labels,
        datasets: [
          { data: data }
        ]
      };
      return res.status(200).send({ success: 1, message: "get data success", data: doughnutChartData });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  schemeBaseLineDetails: async (req, res) => {
    try {
      let validator = new v(req.body, {
        id: "required",
        filterType: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let pointAllocationScheme = await models.pointAllocationModel.findOne({
        where: {
          id: req.body.id
        },
        raw: true
      });

      if (!pointAllocationScheme) {
        return res.status(200).send({ success: 0, message: "Scheme Detail Not Found" });
      }
      let start = req.body.start ?? '2023-01-10';
      let end = req.body.end ?? '2023-12-31';
      let filterType = req.body.filterType ?? 'w';
      //3 year Limit
      if (new Date(end).getTime() - new Date(end).getTime(start) > 1000 * 60 * 60 * 25 * 365 * 3) {
        return res.status(200).send({ success: 0, message: "Date Filter Limit Is 3 Years..." });
      }
      const currentDate = new Date();
      if (filterType == 'w') {
        start = moment(new Date().setDate(new Date().getDate() - 35)).format("YYYY-MM-DD");
        end = moment(new Date()).format("YYYY-MM-DD");
      } else if (filterType == 'm') {
        end = moment(new Date()).format("YYYY-MM-DD");
        start = moment(new Date().setMonth(new Date().getMonth() - 12)).format("YYYY-MM-DD");
      } else if (filterType == 'y') {
        end = moment(new Date()).format("YYYY-MM-DD");
        start = moment(new Date().setFullYear(new Date().getFullYear() - 4)).format("YYYY-MM-DD");
      } else if (filterType == 'c') {

      }

      let duration = {
        'w': 'weekly',
        'm': 'monthly',
        'y': 'yearly',
        'd': 'daily',
        'c': 'daily'
      }
      let filters = generateFilteredDates(new Date(start), new Date(end), duration[`${filterType}`]);
      let filteredDates = filters.filteredDates;
      let filterMonths = filters.filterMonths;

      //get Available customer_products_MM_YY Tables
      let tableListQuery = `SELECT table_name FROM information_schema.tables WHERE table_name like 'customer_products_%'`;

      // filterMonths.forEach(element => {
      //   tableListQuery += `'customer_products_${element}',`;
      // });
      // tableListQuery = tableListQuery.slice(0, -1);
      // tableListQuery += ')';

      let availableTable = await querySQl(tableListQuery);

      let tableList = availableTable.map(x => {
        return x.substr(x.length - 5);
      })
      let chartLabels = [];
      let lineChartData = [];

      let barChartData = [];
      //get count Sku Wize 
      for (let j = 0; j < pointAllocationScheme.sku_id.length; j++) {
        const SKU = pointAllocationScheme.sku_id[j];
        let ProductDetail = await models.productsModel.findOne({
          where: {
            id: SKU
          },
          attributes: ['id', 'sku', 'name'],
          raw: true
        });
        let adOnCount = [];
        let periodbaseCount = [];
        let cumilativeCount = 0;
        for (let i = 0; i < filteredDates.length - 1; i++) {
          let periodCount = 0;
          let startPoint = filteredDates[i].date;
          let endPoint = filteredDates[i + 1].date;
          for (let y = 0; y < tableList.length; y++) {
            const element = tableList[y];
            let customerProductScheme = await DynamicModels.getCustomerProductsModel(element);
            let count = await customerProductScheme.count({
              where:
              {
                product_id: ProductDetail.id,
                scheme_id: { [Op.overlap]: [pointAllocationScheme.id] },
                [Op.and]: [
                  { createdAt: { [Op.gte]: `${moment(startPoint, "YYYY-MM-DD").format("YYYY-MM-DD")} 23:59:59` } },
                  { createdAt: { [Op.lt]: `${moment(endPoint, "YYYY-MM-DD").format("YYYY-MM-DD")} 23:59:59` } },
                ],
              }
            });
            if (count > 0) {
              console.log(startPoint)
            }
            cumilativeCount += count;
            periodCount += count;
          }
          adOnCount.push(cumilativeCount);
          periodbaseCount.push(periodCount);
          if (j == 0) {
            chartLabels.push(moment(new Date(endPoint)).format("YYYY-MM-DD"));
          }
        }
        lineChartData.push({ label: ProductDetail.sku, data: adOnCount });
        barChartData.push({ label: ProductDetail.sku, data: periodbaseCount, stack: pointAllocationScheme.name })
      }
      // labels.forEach(element => {
      //   dataSet.push({ label: element, data: [this.random(), this.random(), this.random()] });
      // });
      // this.lineChartLabels = ['01-11-2023', '08-11-2023', '15-11-2023'];
      // this.lineChartData = dataSet;
      let lineChartDataGroup = {
        lineChartLabels: chartLabels,
        lineChartData: lineChartData
      }

      let barChartDataGroup = {
        barChartLabels: chartLabels,
        barChartData: barChartData
      }
      return res.status(200).send({ success: 1, message: "get data success", data: { lineChartDataGroup, barChartDataGroup } });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },

  getCounterfitCustomer: async (req, res) => {
    try {
      console.log("req::", req.body.fromDate);
      console.log("req::", req.body.toDate);

      let startDate = moment(req.body.fromDate, "YYYY-MM-DD");
      let endDate = moment(req.body.toDate, "YYYY-MM-DD");
      let difference = endDate.diff(startDate, 'days');
      console.log("difference::", difference);
      if (difference < 0) {
        return res.status(200).send({ 'success': 0, 'message': 'Start date can not be greater than End date' });
      }
      if (difference > 31) {
        return res.status(200).send({ 'success': 0, 'message': 'Select 31 Days only' });
      }
      startDate = startDate.format('YYYY-MM-DD') + " 00:00:00";
      endDate = endDate.format('YYYY-MM-DD') + " 23:59:59";

      let data = await CounterfitModel.findAll({
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          },
          type: req.body.type
        },
        include: [
          {
            model: models.cityModel,
            attributes: ["name", "state_code"],
          },
          {
            model: models.ConsumersModel,
            attributes: ["name", "id", "phone"],
          },
          {
            model: models.productsModel,
            attributes: ["name"],
          },
          {
            model: models.ChannelPartners,
            attributes: ["name", "id", "phone"],
          },
          {
            model: models.locationModel,
            attributes: ["zone_id", "region_id", "territory_id"],
            include: [
              {
                model: models.zoneHistoryMasterModels,
                attributes: ["id", "name"]
              },
              {
                model: models.territoryHistoryMasterModel,
                attributes: ["id", "name"]
              },
              {
                model: models.parentZoneHistoryMasterModels,
                attributes: ["id", "name"]
              },
            ]
          },
        ]
      });

      if (data.length < 1) {
        return res.status(200).send({ 'success': 0, 'message': 'No details found!' });
      }

      return res.status(200).send({ success: 1, message: "get data success", data: data });
    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },

  schemeBaseMapDetails: async (req, res) => {
    try {
      let validator = new v(req.body, {
        id: "required",
        filterType: "required"
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let pointAllocationScheme = await models.pointAllocationModel.findOne({
        where: {
          id: req.body.id
        },
        raw: true
      });

      if (!pointAllocationScheme) {
        return res.status(200).send({ success: 0, message: "Scheme Detail Not Found" });
      }
      let start = req.body.start ?? '2023-01-10';
      let end = req.body.end ?? '2023-12-31';
      let filterType = req.body.filterType ?? 'w';
      //3 year Limit
      if (new Date(end).getTime() - new Date(end).getTime(start) > 1000 * 60 * 60 * 25 * 365 * 3) {
        return res.status(200).send({ success: 0, message: "Date Filter Limit Is 3 Years..." });
      }
      const currentDate = new Date();
      if (filterType == 'w') {
        start = moment(new Date().setDate(new Date().getDate() - 35)).format("YYYY-MM-DD");
        end = moment(new Date()).format("YYYY-MM-DD");
      } else if (filterType == 'm') {
        end = moment(new Date()).format("YYYY-MM-DD");
        start = moment(new Date().setMonth(new Date().getMonth() - 5)).format("YYYY-MM-DD");
      } else if (filterType == 'y') {
        end = moment(new Date()).format("YYYY-MM-DD");
        start = moment(new Date().setFullYear(new Date().getFullYear() - 4)).format("YYYY-MM-DD");
      } else if (filterType == 'c') {

      }

      let duration = {
        'w': 'weekly',
        'm': 'monthly',
        'y': 'yearly',
        'd': 'daily',
        'c': 'daily'
      }
      let filters = generateFilteredDates(new Date(start), new Date(end), duration[`${filterType}`]);
      let filteredDates = filters.filteredDates;
      let filterMonths = filters.filterMonths;

      //get Available customer_products_MM_YY Tables
      let tableListQuery = `SELECT table_name FROM information_schema.tables WHERE table_name like 'customer_products_%'`;
      // filterMonths.forEach(element => {
      //   tableListQuery += `'customer_products_${element}',`;
      // });
      // tableListQuery = tableListQuery.slice(0, -1);
      // tableListQuery += ')';

      let availableTable = await querySQl(tableListQuery);

      let tableList = availableTable.map(x => {
        return x.substr(x.length - 5);
      })

      let registoreProductList = [];
      //get count Sku Wize 
      for (let j = 0; j < pointAllocationScheme.sku_id.length; j++) {
        const SKU = pointAllocationScheme.sku_id[j];
        let ProductDetail = await models.productsModel.findOne({
          where: {
            id: SKU
          },
          attributes: ['id', 'sku', 'name'],
          raw: true
        });
        for (let y = 0; y < tableList.length; y++) {
          const element = tableList[y];
          let customerProductScheme = await DynamicModels.getCustomerProductsModel(element);
          let list = await customerProductScheme.findAll({
            where:
            {
              product_id: ProductDetail.id,
              scheme_id: { [Op.overlap]: [pointAllocationScheme.id] },
              [Op.and]: [
                { createdAt: { [Op.gte]: `${moment(start, "YYYY-MM-DD").format("YYYY-MM-DD")} 00:00:00` } },
                { createdAt: { [Op.lt]: `${moment(end, "YYYY-MM-DD").format("YYYY-MM-DD")} 23:59:59` } }
              ],
              // createdAt: {
              //   [Op.between]: [start, end],
              // },
            },
            attributes: ["city_id"],
            raw: true
          });
          registoreProductList.push(...list);
        }
      };

      let cityList = registoreProductList.map(x => x.city_id);
      let uniquecityList = [...new Set(cityList)];

      let stateList = await models.cityModel.findAll({
        where: { id: { [Op.in]: uniquecityList } },
        attributes: ["id", "state_id"],
        group: ["state_id", "id"],
        raw: true
      })

      let data = {
        'IN-4': 0,
        'IN-14': 0,
        'IN-55': 0,
        'IN-AP': stateCityFilter(16, stateList, cityList),//2 Andhra Pradesh
        'IN-AR': stateCityFilter(17, stateList, cityList),//3 Arunachal Pradesh
        'IN-AS': stateCityFilter(1, stateList, cityList),//4 Assam
        'IN-BR': stateCityFilter(2, stateList, cityList),//5 Bihar
        'IN-CH': 0,
        'IN-CT': stateCityFilter(3, stateList, cityList),//7 Chhattisgarh
        'IN-DN': 0,
        'IN-DL': stateCityFilter(18, stateList, cityList),//10 Delhi
        'IN-GA': stateCityFilter(19, stateList, cityList),//11 Goa
        'IN-GJ': stateCityFilter(4, stateList, cityList),//12 Gujarat
        'IN-HR': stateCityFilter(5, stateList, cityList),//13 Haryana
        'IN-HP': stateCityFilter(6, stateList, cityList),//14 Himachal Pradesh
        'IN-JK': stateCityFilter(7, stateList, cityList),//15 Jammu And Kashmir
        'IN-JH': stateCityFilter(20, stateList, cityList),//16  Jharkhand
        'IN-KA': stateCityFilter(21, stateList, cityList),//17 Karnataka
        'IN-KL': stateCityFilter(22, stateList, cityList),//18 Kerala
        'IN-MP': stateCityFilter(8, stateList, cityList),//20 Madhya Pradesh
        'IN-MH': stateCityFilter(9, stateList, cityList),//21 Maharashtra
        'IN-MN': stateCityFilter(25, stateList, cityList),//22 Manipur
        'IN-ML': stateCityFilter(26, stateList, cityList),//23 Meghalaya
        'IN-MZ': stateCityFilter(27, stateList, cityList),//24 Mizoram
        'IN-NL': stateCityFilter(28, stateList, cityList),//25 Nagaland
        'IN-OR': stateCityFilter(29, stateList, cityList),//26 Odisha
        'IN-PB': stateCityFilter(10, stateList, cityList),//28 Punjab
        'IN-RJ': stateCityFilter(11, stateList, cityList),//29 Rajasthan
        'IN-SK': stateCityFilter(31, stateList, cityList),//30 Sikkim
        'IN-TN': stateCityFilter(32, stateList, cityList),//31 Tamil Nadu
        'IN-TG': stateCityFilter(33, stateList, cityList),//32 Telangana
        'IN-TR': stateCityFilter(35, stateList, cityList),//33 Tripura
        'IN-UT': stateCityFilter(12, stateList, cityList),//34 Uttarakhand
        'IN-UP': stateCityFilter(13, stateList, cityList),//35 Uttar Pradesh
        'IN-WB': stateCityFilter(14, stateList, cityList),//36 West Bengal
        'IN-null': 0
      };
      return res.status(200).send({ success: 1, message: "get data success", data: data });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  getChartData: async (req, res) => {
    try {
      let validator = new v(req.params, {
        timeframe: "required"
      });
      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }
      let whereClause = {
        retailer_id: req.retailerId,
        retail_outlet_id: req.retailOutletId
      };
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let tableUid = req.tableUid;
      let filterType = req.params.timeframe;
      let start, end;
      // Adjust start and end dates based on filterType
      if (filterType === 't') { // Today
        start = moment().startOf('day').format("YYYY-MM-DD HH:mm:ss");
        end = moment().endOf('day').format("YYYY-MM-DD HH:mm:ss");
      } else if (filterType === 'w') { // This Week
        start = moment().startOf('week').format("YYYY-MM-DD");
        end = moment().endOf('week').format("YYYY-MM-DD");
      } else if (filterType === 'm') { // This Month
        start = moment().startOf('month').format("YYYY-MM-DD");
        end = moment().endOf('month').format("YYYY-MM-DD");
      } else if (filterType === 'q') { // This Quarter
        start = moment().startOf('quarter').format("YYYY-MM-DD");
        end = moment().endOf('quarter').format("YYYY-MM-DD");
      } else if (filterType === 'y') { // This Year
        start = moment().startOf('year').format("YYYY-MM-DD");
        end = moment().endOf('year').format("YYYY-MM-DD");
      } else if (filterType === 'yes') { // Yesterday
        start = moment().subtract(1, 'days').startOf('day').format("YYYY-MM-DD HH:mm:ss");
        end = moment().subtract(1, 'days').endOf('day').format("YYYY-MM-DD HH:mm:ss");
      } else if (filterType === 'pw') { // Previous Week
        start = moment().subtract(1, 'weeks').startOf('week').format("YYYY-MM-DD");
        end = moment().subtract(1, 'weeks').endOf('week').format("YYYY-MM-DD");
      } else if (filterType === 'pm') { // Previous Month
        start = moment().subtract(1, 'months').startOf('month').format("YYYY-MM-DD");
        end = moment().subtract(1, 'months').endOf('month').format("YYYY-MM-DD");
      } else if (filterType === 'pq') { // Previous Quarter
        start = moment().subtract(1, 'quarters').startOf('quarter').format("YYYY-MM-DD");
        end = moment().subtract(1, 'quarters').endOf('quarter').format("YYYY-MM-DD");
      } else if (filterType === 'py') { // Previous Year
        start = moment().subtract(1, 'years').startOf('year').format("YYYY-MM-DD");
        end = moment().subtract(1, 'years').endOf('year').format("YYYY-MM-DD");
      } else if (filterType === 'c') { // Custom
        start = moment(req.query.startDate).startOf('day').format("YYYY-MM-DD HH:mm:ss");
        end = moment(req.query.endDate).endOf('day').format("YYYY-MM-DD HH:mm:ss");
      } else {
        return res.status(400).send({ success: 0, message: "Invalid timeframe" });
      }

      // Fetch purchase data
      let purchaseOrderModel = await models.dynamicModel.getPurchaseOrderModel(tableUid);
      let purchaseData = await purchaseOrderModel.findAll({
        where: {
          ...whereClause,
          is_return: false,
          createdAt: {
            [Op.between]: [start, end]
          }
        },
        attributes: [[fn('SUM', col('total_amount')), 'total_amount']],
        raw: true
      });

      // Fetch sales data
      let salesModel = await models.dynamicModel.getSalesModel(tableUid);
      let salesData = await salesModel.findAll({
        where: {
          ...whereClause,
          is_return: false,
          createdAt: {
            [Op.between]: [start, end]
          }
        },
        attributes: [[fn('SUM', col('total_amount')), 'total_amount']],
        raw: true
      });

      // Fetch purchase return data
      let purchaseReturnOrderModel = await models.dynamicModel.getPurchaseOrderModel(tableUid);
      let purchaseReturnData = await purchaseReturnOrderModel.findAll({
        where: {
          ...whereClause,
          is_return: true,
          createdAt: {
            [Op.between]: [start, end]
          }
        },
        attributes: [[fn('SUM', col('total_amount')), 'total_amount']],
        raw: true
      });

      // Fetch sales return data
      let salesReturnModel = await models.dynamicModel.getSalesModel(tableUid);
      let salesReturnData = await salesReturnModel.findAll({
        where: {
          ...whereClause,
          is_return: true,
          createdAt: {
            [Op.between]: [start, end]
          }
        },
        attributes: [[fn('SUM', col('total_amount')), 'total_amount']],
        raw: true
      });


      const totalPurchaseAmount = purchaseData.length > 0 ? parseFloat(purchaseData[0].total_amount) : 0;
      const totalSalesAmount = salesData.length > 0 ? parseFloat(salesData[0].total_amount) : 0;
      const totalPurchaseReturnAmount = purchaseReturnData.length > 0 ? parseFloat(purchaseReturnData[0].total_amount) : 0;
      const totalSalesReturnAmount = salesReturnData.length > 0 ? parseFloat(salesReturnData[0].total_amount) : 0;

      // Return the combined data
      return res.status(200).send({
        success: 1,
        message: "Data fetched successfully",
        data: {
          totalPurchaseAmount,
          totalSalesAmount,
          totalPurchaseReturnAmount,
          totalSalesReturnAmount
        }
      });

    } catch (error) {
      console.log(error);
      logger.error(req, error.message);
      return res.status(500).send({ message: error.toString() });
    }
  },
  getExpiredData: async (req, res) => {
    try {
      let validator = new v(req.params, {
        status: "required"
      });
      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      let status = req.params.status; // status can be 'expiring' or 'expired'
      let retailBatchSchema = await models.retailerBatchSchema(req.tableUid);

      let whereClause = {
        retailer_id: req?.retailerId ?? null,
        retail_outlet_id: req?.retailOutletId ?? null,
      };

      let BatchList = await retailBatchSchema.retailBatchModels.findAll({
        where: whereClause,
        include: [
          {
            model: retailBatchSchema.batchStockModels,
            required: false,
            attributes: ['qty'],
            as: 'batchStock',
            raw: true,
            nest: true
          },
          {
            model: models.productsModel,
            attributes: ['id', 'name'],
            as: 'products',
            raw: true,
            nest: true
          },
        ],
        order: [['createdAt', 'DESC']],
        raw: true,
        nest: true
      });
      let today = moment().startOf('day').toDate();
      let filteredList;
      if (status === 'expiring') {
        // Expiring items from today to upcoming dates
        filteredList = BatchList.filter(item => item.exp_date >= today);
      } else if (status === 'expired') {
        // Expired items until yesterday
        filteredList = BatchList.filter(item => item.exp_date < today);
      } else {
        return res.status(200).send({ success: 0, message: "Invalid status parameter" });
      }
      if (BatchList.length == 0) {
        return res.status(200).send({ success: 1, message: "No Batch Available" });
      }
      return res.status(200).send({ success: 1, data: filteredList });

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  getCustomerData: async (req, res) => {
    try {
      if (!req.tableUid) {
        return res.status(400).send({ success: 0, message: "Table UID not available" });
      }

      let dynamicRetailModel = await models.dynamicModel.getRetailCustomerMasterModel(req.tableUid);

      let retailCustomerList = await dynamicRetailModel.findAll({
        where: {
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId
        },
        include: [
          {
            model: models.ConsumersModel,
            attributes: ['id', 'first_name', 'last_name'],
            as: 'consumers',
            raw: true,
            nest: true
          }
        ],
        nest: true,
        raw: true
      });

      if (retailCustomerList.length === 0) {
        return res.status(200).send({
          success: 0,
          message: "Customer details are currently unavailable. Please try again later."
        });
      }
      const totalPendingAmount = retailCustomerList.reduce((sum, customer) => {
        console.log(`Processing customer: ${customer.consumers.first_name} ${customer.consumers.last_name}, pending_amount: ${customer.pending_amount}`);
        return sum + (parseFloat(customer.pending_amount) || 0);
      }, 0);
      const returnPendingAmount = retailCustomerList.reduce((sum, customer) => {
        console.log(`Processing customer: ${customer.consumers.first_name} ${customer.consumers.last_name}, pending_amount: ${customer.pending_amount}`);
        return sum + (parseFloat(customer.return_pending_amount) || 0);
      }, 0);

      console.log("All consumers:", retailCustomerList);
      return res.status(200).send({
        success: 1,
        data: {
          customers: retailCustomerList,
          totalPendingAmount,
          returnPendingAmount
        }
      });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: error.toString()
      });
    }
  },
  getDistributorData: async (req, res) => {
    try {
      if (!req.tableUid) {
        return res.status(400).send({ success: 0, message: "Table UID not available" });
      }

      let dynamicRetailModel = await models.dynamicModel.getRetailDistributorMasterModel(req.tableUid);

      let retailDistributorList = await dynamicRetailModel.findAll({
        where: {
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId
        },
        include: [
          {
            model: models.DistributorsModel,
            attributes: ['id', 'name'],
            as: 'distributors',
            raw: true,
            nest: true
          }
        ],
        nest: true,
        raw: true
      });

      if (retailDistributorList.length === 0) {
        return res.status(200).send({
          success: 0,
          message: "Customer details are currently unavailable. Please try again later."
        });
      }
      const totalPendingAmount = retailDistributorList.reduce((sum, distributor) => {
        return sum + (parseFloat(distributor.pending_amount) || 0);
      }, 0);
      const returnPendingAmount = retailDistributorList.reduce((sum, distributor) => {
        return sum + (parseFloat(distributor.return_pending_amount) || 0);
      }, 0);

      console.log("All consumers:", retailDistributorList);
      return res.status(200).send({
        success: 1,
        data: {
          distributors: retailDistributorList,
          totalPendingAmount,
          returnPendingAmount
        }
      });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: error.toString()
      });
    }
  }
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
  // const [data, meta] = await db.sequelize.query(Condition)
  //   .then(result => {
  //     if (result == null) return null;
  //     return result;
  //   }).catch(err => {
  //     return null;
  //   })
  return data.flat();
}

function stateCityFilter(stateId, stateList, cityList) {
  let stateCityList = stateList.filter(x => x.state_id == stateId).map(x => x.id);
  if (stateCityList.length == 0) {
    return 0;
  }
  let states = cityList.filter(x => stateCityList.includes(x));
  return states.length;
}


module.exports = dashboard_report;

