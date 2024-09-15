const v = require('node-input-validator');
const message = require('../i18n/en');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const uuid = require("uuid");

const logger = require('../helpers/logger');
const parseValidate = require('../middleware/parseValidate');

//models
const models = require("./_models");
const ZRTModels = require("../models/").ZRT;
const ZRT1Models = require("../models/").ZRT1;

// controllers
const commonController = require('../controllers/common');
var createLocations = {
  makeNewTables1: async (req, res) => {
    try {
      var a1 = 0, a2 = 0, a3 = 0, a4 = 0;
      let ZRT = await ZRTModels.findAll({ attributes: ['state'], group: ['state'], order: [['state', 'ASC']], raw: true });
      for (let x = 1; x <= ZRT.length; x++) {
        const elementx = ZRT[x - 1];
        a1 += 1;
        let district = await ZRTModels.findAll({ where: { state: elementx.state }, attributes: ['district'], group: ['district'], order: [['district', 'ASC']], raw: true });
        for (let y = 1; y <= district.length; y++) {
          const elementy = district[y - 1];
          a2 += 1;
          let taluka = await ZRTModels.findAll({ where: { state: elementx.state, district: elementy.district }, attributes: ['taluka'], group: ['taluka'], order: [['taluka', 'ASC']], raw: true });
          for (let z = 1; z <= taluka.length; z++) {
            const elementz = taluka[z - 1];
            a3 += 1;
            let village = await ZRTModels.findAll({ where: { state: elementx.state, district: elementy.district, taluka: elementz.taluka }, attributes: ['village'], group: ['village'], order: [['village', 'ASC']], raw: true });
            let vill = village.map(x => x.village);
            let pincodes = await ZRTModels.findAll({ where: { state: elementx.state, district: elementy.district, taluka: elementz.taluka, village: { [Op.in]: vill } }, attributes: ['pincode', 'village'], raw: true });
            console.log(village);
            let villageList = [];
            let pincodeList = [];
            for (let a = 1; a <= village.length; a++) {
              const elementa = village[a - 1];
              a4 += 1;
              villageList.push({
                id: a4, name: elementa.village,
                country_id: '101', country_code: 'IN',
                state_id: a1, state_code: elementx.state,
                district_id: a2, district_name: elementy.district,
                taluks_id: a3, taluks_name: elementz.taluka
              });
              // await models.cityModel.create();
              let code = pincodes.filter(x => x.village == elementa.village);
              // console.log(code[0].pincode)
              pincodeList.push({
                id: a4,
                pincode: code[0].pincode,
                state_id: a1,
                district_id: a2,
                taluks_id: a3,
                city_id: a4
              })
              // await models.pincodeModel.create();
            }
            await models.cityModel.bulkCreate(villageList);
            await models.pincodeModel.bulkCreate(pincodeList);
            await models.taluksModel.create({ id: a3, name: elementz.taluka, country_id: '101', country_code: 'IN', state_id: a1, state_code: elementx.state, district_id: a2, district_name: elementy.district });
          }
          await models.districtModel.create({ id: a2, name: elementy.district, country_id: '101', country_code: 'IN', state_id: a1, state_code: elementx.state });
        }
        await models.stateModel.create({ id: a1, name: elementx.state, country_id: '101', country_code: 'IN' });
      }
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  makeNewTables2: async (req, res) => {
    try {
      var a1 = 0, a2 = 0, a3 = 0, a4 = 0;
      let state_id = [];
      let district_id = [];
      let taluka_id = [];

      let ZRT = await ZRTModels.findAll({ order: [['village_id', 'ASC']], raw: true });
      for (let index = 0; index < ZRT.length; index++) {
        console.log(`${ZRT.length} // ${index}`)
        const ZRTs = ZRT[index];
        if (!state_id.includes(ZRTs.state_id)) {
          state_id.push(ZRTs.state_id);
          await models.stateModel.upsert({ id: ZRTs.state_id, name: ZRTs.state, country_id: '101', country_code: 'IN' },
            {
              where: {
                id: ZRTs.state_id
              }
            }
          );
        }
        if (!district_id.includes(ZRTs.district_id)) {
          district_id.push(ZRTs.district_id);
          await models.districtModel.upsert({ id: ZRTs.district_id, name: ZRTs.district, country_id: '101', country_code: 'IN', state_id: ZRTs.state_id, state_code: ZRTs.state },
            {
              where: {
                id: ZRTs.district_id
              }
            }
          );
        }
        if (!taluka_id.includes(ZRTs.taluka_id)) {
          taluka_id.push(ZRTs.taluka_id)
          await models.taluksModel.upsert({ id: ZRTs.taluka_id, name: ZRTs.taluka, country_id: '101', country_code: 'IN', state_id: ZRTs.state_id, state_code: ZRTs.state, district_id: ZRTs.district_id, district_name: ZRTs.district },
            {
              where: {
                id: ZRTs.taluka_id
              }
            }
          );
        }

        await models.cityModel.bulkCreate([{
          id: ZRTs.village_id,
          name: ZRTs.village,
          country_id: '101',
          country_code: 'IN',
          state_id: ZRTs.state_id, state_code: ZRTs.state,
          district_id: ZRTs.district_id, district_name: ZRTs.district,
          taluks_id: ZRTs.taluka_id, taluks_name: ZRTs.taluka
        }]);
        await models.pincodeModel.bulkCreate([{
          id: ZRTs.id,
          pincode: ZRTs.pincode,
          state_id: ZRTs.state_id,
          district_id: ZRTs.district_id,
          taluks_id: ZRTs.taluka_id,
          city_id: ZRTs.village_id,
        }]);
      }

    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  makeNewTables: async (req, res) => {
    try {
      var a1 = 0, a2 = 0, a3 = 0, a4 = 0;
      let ZRT = await ZRTModels.findAll({ attributes: ['state'], group: ['state'], order: [['state', 'ASC']], raw: true });
      for (let x = 1; x <= ZRT.length; x++) {
        const elementx = ZRT[x - 1];
        a1 += 1;
        let district = await ZRTModels.findAll({ where: { state: elementx.state }, attributes: ['district'], group: ['district'], order: [['district', 'ASC']], raw: true });
        for (let y = 1; y <= district.length; y++) {
          const elementy = district[y - 1];
          a2 += 1;
          let taluka = await ZRTModels.findAll({ where: { state: elementx.state, district: elementy.district }, attributes: ['taluka'], group: ['taluka'], order: [['taluka', 'ASC']], raw: true });
          for (let z = 1; z <= taluka.length; z++) {
            const elementz = taluka[z - 1];
            a3 += 1;
            let village = await ZRTModels.findAll({ where: { state: elementx.state, district: elementy.district, taluka: elementz.taluka }, attributes: ['village'], group: ['village'], order: [['village', 'ASC']], raw: true });
            let vill = village.map(x => x.village);
            let pincodes = await ZRTModels.findAll({ where: { state: elementx.state, district: elementy.district, taluka: elementz.taluka, village: { [Op.in]: vill } }, attributes: ['pincode', 'village'], raw: true });
            console.log(village);
            let villageList = [];
            let pincodeList = [];
            for (let a = 1; a <= village.length; a++) {
              const elementa = village[a - 1];
              a4 += 1;
              villageList.push({
                id: a4, name: elementa.village,
                country_id: '101', country_code: 'IN',
                state_id: a1, state_code: elementx.state,
                district_id: a2, district_name: elementy.district,
                taluks_id: a3, taluks_name: elementz.taluka
              });
              // await models.cityModel.create();
              let code = pincodes.filter(x => x.village == elementa.village);
              // console.log(code[0].pincode)
              for (let indexb = 0; indexb < code.length; indexb++) {
                if (code.length > 2) {
                  console.log(code)
                }
                const element = code[indexb];
                if (code[indexb].pincode) {
                  pincodeList.push({
                    id: a4,
                    pincode: code[indexb].pincode,
                    state_id: a1,
                    district_id: a2,
                    taluks_id: a3,
                    city_id: a4
                  })
                }
                else {
                  console.log("non")
                }
              }
              // await models.pincodeModel.create();
            }
            await models.cityModel.bulkCreate(villageList);
            await models.pincodeModel.bulkCreate(pincodeList);
            await models.taluksModel.create({ id: a3, name: elementz.taluka, country_id: '101', country_code: 'IN', state_id: a1, state_code: elementx.state, district_id: a2, district_name: elementy.district });
          }
          await models.districtModel.create({ id: a2, name: elementy.district, country_id: '101', country_code: 'IN', state_id: a1, state_code: elementx.state });
        }
        await models.stateModel.create({ id: a1, name: elementx.state, country_id: '101', country_code: 'IN' });
      }
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },

  makeZRTMster2: async (req, res) => {
    try {
      for (let index = 0; index < ZRT.length; index++) {
        const element = ZRT[index];
        let zoneHistory = await models.parentZoneHistoryMasterModels.findAll({ where: { unique_id: element.Zone }, raw: true });

        let regionHistory = await models.zoneHistoryMasterModels.findAll({ where: { unique_id: element.region }, raw: true });
        let regionChild = await models.zoneChildMasterModel.findAll({ where: { zone_history_id: regionHistory[0].id }, raw: true });
        let districtList = [];
        for (let index = 0; index < regionChild.length; index++) {
          const element = regionChild[index];
          districtList.push(...element.cities);
        }
        let zrtClientList = await ZRT1Models.findAll({
          where: {
            territory: {
              [Op.iLike]: `%${element.territory}%`, // Replace with your specific comparison criteria
            },
          }, raw: true
        });
        console.log(element.territory, " <<<< Territory")
        let villageNameList = zrtClientList.map(x => x.village);
        let villageIds = [];
        let villageInfo = [];
        for (let index = 0; index < villageNameList.length; index++) {
          const element = villageNameList[index];
          let cities = await models.cityModel.findOne({
            where: {
              state_id: { [Op.in]: zoneHistory[0].states },
              district_id: { [Op.in]: districtList },
              name: element,
              // name: {
              //   [Op.iLike]: `%${element}%`, // Replace with your specific comparison criteria
              // },
              is_allocated: false
            },
            raw: true
          })
          // let cities = null;
          if (cities) {
            villageIds.push(cities.id);
            villageInfo.push(cities);
            console.log(`${index} << ${villageNameList.length}`);
          }
        }
        let territoryId = uuid();
        let historyId = uuid();
        let talukaList = [...new Set(villageInfo.map(x => x.taluks_id))];
        await models.territoryMasterModel.create({
          id: territoryId,//
          unique_id: element.territory,
          name: element.territory,
          zone_id: zoneHistory[0].zone_id,
          zone_history_id: zoneHistory[0].id,
          region_id: regionHistory[0].zone_id,//
          region_history_id: regionHistory[0].id,//
          terriotory_history_id: historyId,//
          district_id: districtList,//
          talukas: talukaList,//
          villages: villageIds//

        });
        await models.territoryHistoryMasterModel.create({
          id: historyId,//
          unique_id: element.territory,
          name: element.territory,
          territory_id: territoryId,//
          zone_id: zoneHistory[0].zone_id,
          zone_history_id: zoneHistory[0].id,
          region_id: regionHistory[0].zone_id,//
          region_history_id: regionHistory[0].id,//
          terriotory_history_id: historyId,//
          district_id: districtList,//
          talukas: talukaList,//
          villages: villageIds//
        });

        // , zone_history_id: zoneHistoryDetail.zone_history_id, region_history_id: RegionHistoryDetail.zone_history_id, terriotory_history_id : historyId
        // await models.cityModel.update({ is_allocated: true, region_history_id: regionHistory[0].id, zone_history_id: zoneHistory[0].id, terriotory_history_id: historyId }, { where: { id: { [Op.in]: villageIds } } });
      }
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  makeZRTMster: async (req, res) => {
    try {
      let territories = await models.territoryMasterModel.findAll({ where: {}, order: [["createdAt", "ASC"]], raw: true });
      for (let index = 0; index < 30; index++) {
        const element = territories[index];
        await models.cityModel.update({ is_allocated: true, region_history_id: element.region_history_id, zone_history_id: element.zone_history_id, terriotory_history_id: element.terriotory_history_id }, { where: { id: { [Op.in]: element.villages } } });

      }
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },

  makeZRTMsterZone: async (req, res) => {
    try {
      let ZRT = await models.parentZoneMasterModel.findAll({ raw: true });
      for (let index = 0; index < ZRT.length; index++) {
        const element = ZRT[index];
        let zoneHistory = await models.parentZoneHistoryMasterModels.findAll({ where: { unique_id: element.unique_id }, raw: true });
        // let regionHistory = await models.zoneHistoryMasterModels.findAll({ where: { unique_id: element.region }, raw: true });
        // let territoryHistory = await models.territoryHistoryMasterModel.findAll({ where: { unique_id: element.territory }, raw: true });

        let zoneStates = await ZRTModels.findAll({ where: { "Zone": element.unique_id }, attributes: ['state'], group: ['state'], raw: true });
        let StateList = zoneStates.map(x => x.state);

        let FindstateIds = await models.stateModel.findAll({ where: { name: { [Op.in]: StateList } }, attributes: ['id'], raw: true });
        let zoneStateList = FindstateIds.map(x => x.id);

        let x = await models.parentZoneMasterModel.update({
          states: zoneStateList
        }, { where: { id: zoneHistory[0].zone_id } });

        let y = await models.parentZoneHistoryMasterModels.update({
          states: zoneStateList,
        }, { where: { id: zoneHistory[0].id } });


      }
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },

  makeZRTMsterRegion: async (req, res) => {
    try {
      let ZRT = await models.parentZoneMasterModel.findAll({ raw: true });
      for (let index = 0; index < ZRT.length; index++) {
        const element = ZRT[index];
        let zoneHistory = await models.parentZoneHistoryMasterModels.findAll({ where: { unique_id: element.unique_id }, raw: true });
        // let regionHistory = await models.zoneHistoryMasterModels.findAll({ where: { unique_id: element.region }, raw: true });
        // let territoryHistory = await models.territoryHistoryMasterModel.findAll({ where: { unique_id: element.territory }, raw: true });

        let zoneStates = await ZRTModels.findAll({ where: { "Zone": element.unique_id }, attributes: ['state'], group: ['state'], raw: true });
        let StateList = zoneStates.map(x => x.state);

        let FindstateIds = await models.stateModel.findAll({ where: { name: { [Op.in]: StateList } }, attributes: ['id'], raw: true });
        let zoneStateList = FindstateIds.map(x => x.id);

        let x = await models.parentZoneMasterModel.update({
          states: zoneStateList
        }, { where: { id: zoneHistory[0].zone_id } });

        let y = await models.parentZoneHistoryMasterModels.update({
          states: zoneStateList,
        }, { where: { id: zoneHistory[0].id } });


      }
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },

  makeZRTMsterRegion: async (req, res) => {
    try {
      let ZRT = await models.zoneHistoryMasterModels.findAll({ raw: true });
      for (let index = 0; index < ZRT.length; index++) {
        const element = ZRT[index];
        let regionHistory = await models.zoneHistoryMasterModels.findAll({ where: { unique_id: element.unique_id }, raw: true });
        let zoneHistory = await models.parentZoneHistoryMasterModels.findAll({ where: { id: regionHistory[0].parent_zone_history_id }, raw: true });
        // let territoryHistory = await models.territoryHistoryMasterModel.findAll({ where: { unique_id: element.territory }, raw: true });

        for (let index = 0; index < zoneHistory[0].states.length; index++) {
          const element1 = zoneHistory[0].states[index];
          let stateName = await models.stateModel.findAll({ where: { id: element1 }, raw: true });
          let regionStates = await ZRTModels.findAll({ where: { "region": element.unique_id, state: stateName[0].name }, attributes: ['district'], group: ['district'], raw: true });
          let districtList = regionStates.map(x => x.district);

          let FindstateIds = await models.districtModel.findAll({ where: { name: { [Op.in]: districtList } }, attributes: ['id'], raw: true });
          let List = FindstateIds.map(x => x.id);

          await models.zoneChildMasterModel.upsert({
            id: uuid(),
            zone_id: regionHistory[0].id,
            state_id: element1,
            state_code: "",
            cities: List,
            zone_history_id: regionHistory[0].id,
            zone_id: regionHistory[0].zone_id,
            parent_zone_id: regionHistory[0].parent_zone_id,
            parent_zone_history_id: regionHistory[0].parent_zone_history_id,
          }, {
            where: {
              zone_history_id: regionHistory[0].id,
              state_id: element1,
              zone_id: regionHistory[0].zone_id,
            }
          });

        }



      }
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },

  makeZRTMsterTerritory: async (req, res) => {
    try {
      let ZRT = await models.territoryMasterModel.findAll({ raw: true });
      for (let index = 0; index < ZRT.length; index++) {
        const element = ZRT[index];
        let territoryHistory = await models.territoryHistoryMasterModel.findAll({ where: { unique_id: element.unique_id }, raw: true });
        let regionHistory = await models.zoneChildMasterModel.findAll({ where: { id: territoryHistory[0].region_history_id }, raw: true });
        let regionchilds = await models.zoneChildMasterModel.findAll({ where: { zone_history_id: territoryHistory[0].region_history_id }, raw: true });
        let zoneHistory = await models.parentZoneHistoryMasterModels.findAll({ where: { id: territoryHistory[0].zone_history_id }, raw: true });

        let zrtVillage = await ZRTModels.findAll({ where: { territory: element.unique_id }, attributes: ['village'], group: ['village', 'taluka'], raw: true });
        let zrttalukaList = await ZRTModels.findAll({ where: { territory: element.unique_id }, attributes: ['taluka'], group: ['taluka'], raw: true });
        let zrtdistrict = await ZRTModels.findAll({ where: { territory: element.unique_id }, attributes: ['district'], group: ['district'], raw: true });

        let v = zrtVillage.map(x => x.village);
        let t = zrttalukaList.map(x => x.taluka);
        let d = zrtdistrict.map(x => x.district);

        let villageIdss = await models.cityModel.findAll({ where: { name: { [Op.in]: v } }, attributes: ['id'], raw: true });
        let talukaIdss = await models.taluksModel.findAll({ where: { name: { [Op.in]: t } }, attributes: ['id'], raw: true });
        let districtIdss = await models.districtModel.findAll({ where: { name: { [Op.in]: d } }, attributes: ['id'], raw: true });

        let villageIds = villageIdss.map(x => x.id);
        let talukaIds = talukaIdss.map(x => x.id);
        let districtIds = districtIdss.map(x => x.id);
        let ter = territoryHistory[0];
        await models.territoryMasterModel.update({
          // id: ter.id,
          // unique_id: ter.unique_id,
          // territory_id: ter.territory_id,
          // zone_id: ter.zone_id,
          // zone_history_id: ter.zone_history_id,
          // region_id: ter.region_id,
          // region_history_id: ter.region_history_id,
          // terriotory_history_id: ter.terriotory_history_id,
          district_id: districtIds,
          talukas: talukaIds,
          villages: villageIds
        }, { where: { id: ter.territory_id } });

        await models.territoryHistoryMasterModel.update({
          // id: ter.id,
          // unique_id: ter.unique_id,
          // territory_id: ter.territory_id,
          // zone_id: ter.zone_id,
          // zone_history_id: ter.zone_history_id,
          // region_id: ter.region_id,
          // region_history_id: ter.region_history_id,
          // terriotory_history_id: ter.terriotory_history_id,
          district_id: districtIds,
          talukas: talukaIds,
          villages: villageIds
        }, { where: { id: ter.terriotory_history_id } });

        // , zone_history_id: zoneHistoryDetail.zone_history_id, region_history_id: RegionHistoryDetail.zone_history_id, terriotory_history_id : historyId
        await models.cityModel.update({ is_allocated: true, terriotory_history_id: territoryHistory[0].terriotory_history_id, region_history_id: territoryHistory[0].region_history_id, zone_history_id: territoryHistory[0].zone_history_id }, { where: { id: { [Op.in]: villageIds, is_allocated: false } } });


      }
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },

  makeNewTablesx: async (req, res) => {
    try {
      var a1 = 0, a2 = 377, a3 = 3096, a4 = 396455;
      var d = 377; t = 3096, c = 396455;
      let ZRT = await models.stateModel.findAll({ order: [['id', 'ASC']], raw: true });
      for (let x = 1; x <= ZRT.length; x++) {
        const elementx = ZRT[x - 1];
        a1 = elementx.id;
        let district = await ZRTModels.findAll({ where: { state: elementx.name }, attributes: ['district'], group: ['district'], order: [['district', 'ASC']], raw: true });
        for (let y = 1; y <= district.length; y++) {
          const elementy = district[y - 1];
          let dist = await models.districtModel.findAll({ where: { name: elementy.district }, raw: true });
          if (dist.length == 0) {
            a2 = d;
            a2 += 1;
            d = a2;
          }
          else {
            a2 = dist[0].id;
          }

          let taluka = await ZRTModels.findAll({ where: { state: elementx.name, district: elementy.district }, attributes: ['taluka'], group: ['taluka'], order: [['taluka', 'ASC']], raw: true });
          for (let z = 1; z <= taluka.length; z++) {
            const elementz = taluka[z - 1];
            let talik = await models.taluksModel.findAll({ where: { name: elementz.taluka }, raw: true });
            if (talik.length == 0) {
              a3 = t;
              a3 += 1;
              t = a3;

              let village = await ZRTModels.findAll({ where: { state: elementx.name, district: elementy.district, taluka: elementz.taluka }, attributes: ['village'], group: ['village'], order: [['village', 'ASC']], raw: true });
              let vill = village.map(x => x.village);
              let pincodes = await ZRTModels.findAll({ where: { state: elementx.name, district: elementy.district, taluka: elementz.taluka, village: { [Op.in]: vill } }, attributes: ['pincode', 'village'], raw: true });
              console.log(village);
              let villageList = [];
              let pincodeList = [];
              for (let a = 1; a <= village.length; a++) {
                const elementa = village[a - 1];
                a4 += 1;
                villageList.push({
                  id: a4, name: elementa.village,
                  country_id: '101', country_code: 'IN',
                  state_id: a1, state_code: elementx.name,
                  district_id: a2, district_name: elementy.district,
                  taluks_id: a3, taluks_name: elementz.taluka
                });
                // await models.cityModel.create();
                let code = pincodes.filter(x => x.village == elementa.village);
                // console.log(code[0].pincode)
                for (let indexb = 0; indexb < code.length; indexb++) {
                  if (code.length > 2) {
                    console.log(code)
                  }
                  const element = code[indexb];
                  if (code[indexb].pincode) {
                    pincodeList.push({
                      id: a4,
                      pincode: code[indexb].pincode,
                      state_id: a1,
                      district_id: a2,
                      taluks_id: a3,
                      city_id: a4
                    })
                  }
                  else {
                    console.log("non")
                  }
                }
                // await models.pincodeModel.create();
              }
              await models.cityModel.bulkCreate(villageList);
              await models.pincodeModel.bulkCreate(pincodeList);
              await models.taluksModel.create({ id: a3, name: elementz.taluka, country_id: '101', country_code: 'IN', state_id: a1, state_code: elementx.name, district_id: a2, district_name: elementy.district });
            }
            else {
              a3 = talik[0].id;
            }
          }
          let districts = await models.districtModel.findAll({ where: { name: elementy.district }, raw: true });
          if (districts.length == 0) {
            await models.districtModel.create({ id: a2, name: elementy.district, country_id: '101', country_code: 'IN', state_id: a1, state_code: elementx.name });
          }
        }
        // await models.stateModel.create({ id: a1, name: elementx.state, country_id: '101', country_code: 'IN' });
      }
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
};
module.exports = createLocations;

let ZRT = [
  {
    "territory": "Ratlam",
    "region": "Indore",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Sagar",
    "region": "Cantral MP",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Sikar",
    "region": "Jaipur",
    "Zone": "Rajasthan"
  },
  {
    "territory": "Ahmednagar",
    "region": "Khandesh",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Patiala",
    "region": "Bathinda Region",
    "Zone": "Punjab"
  },
  {
    "territory": "Kaithal",
    "region": "Karnal Region",
    "Zone": "Haryana"
  },
  {
    "territory": "Burdwan East",
    "region": "Burdwan Region",
    "Zone": "West Bengal"
  },
  {
    "territory": "Dwarka",
    "region": "Rajkot",
    "Zone": "Gujarat"
  },
  {
    "territory": "Amritsar",
    "region": "Bathinda Region",
    "Zone": "Punjab"
  },
  {
    "territory": "Pandharpur",
    "region": "Western Maharashtra",
    "Zone": "Maharashtra"
  },
  {
    "territory": "24 Parganas North",
    "region": "Central Bengal",
    "Zone": "West Bengal"
  },
  {
    "territory": "Anand",
    "region": "Central Gujarat",
    "Zone": "Gujarat"
  },
  {
    "territory": "Tinsukia",
    "region": "Guwahati",
    "Zone": "Assam"
  },
  {
    "territory": "Hapur",
    "region": "Ghaziabad Region",
    "Zone": "Uttar Pradesh"
  },
  {
    "territory": "Kanpur",
    "region": "Lucknow Region",
    "Zone": "Uttar Pradesh"
  },
  {
    "territory": "Chittorgarh",
    "region": "Jodhpur",
    "Zone": "Rajasthan"
  },
  {
    "territory": "Saharsa",
    "region": "North Bihar",
    "Zone": "Bihar"
  },
  {
    "territory": "Nagpur",
    "region": "Vidharbha",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Sumerpur",
    "region": "Jodhpur",
    "Zone": "Rajasthan"
  },
  {
    "territory": "Sopore",
    "region": "Srinagar Region",
    "Zone": "J & K"
  },
  {
    "territory": "Jhalawar",
    "region": "Jaipur",
    "Zone": "Rajasthan"
  },
  {
    "territory": "Chindwada",
    "region": "Cantral MP",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Abohar",
    "region": "Bathinda Region",
    "Zone": "Punjab"
  },
  {
    "territory": "Petlawad",
    "region": "Indore",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Agra",
    "region": "Ghaziabad Region",
    "Zone": "Uttar Pradesh"
  },
  {
    "territory": "Bhandara",
    "region": "Vidharbha",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Malda",
    "region": "Central Bengal",
    "Zone": "West Bengal"
  },
  {
    "territory": "Sri Ganganagar",
    "region": "Sri Ganganagar",
    "Zone": "Rajasthan"
  },
  {
    "territory": "Buxar",
    "region": "North Bihar",
    "Zone": "Bihar"
  },
  {
    "territory": "Hisar",
    "region": "Hissar Region",
    "Zone": "Haryana"
  },
  {
    "territory": "Nadiyad",
    "region": "Central Gujarat",
    "Zone": "Gujarat"
  },
  {
    "territory": "Jalgaon",
    "region": "Khandesh",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Purnia",
    "region": "North Bihar",
    "Zone": "Bihar"
  },
  {
    "territory": "Rajula",
    "region": "Junagadh",
    "Zone": "Gujarat"
  },
  {
    "territory": "Nadia",
    "region": "Central Bengal",
    "Zone": "West Bengal"
  },
  {
    "territory": "Dhoraji",
    "region": "Rajkot",
    "Zone": "Gujarat"
  },
  {
    "territory": "Nanded",
    "region": "Marathwada",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Manawar",
    "region": "Nimar",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Fatehabad",
    "region": "Hissar Region",
    "Zone": "Haryana"
  },
  {
    "territory": "Mehsana",
    "region": "Ahmedabad",
    "Zone": "Gujarat"
  },
  {
    "territory": "Rajkot",
    "region": "Rajkot",
    "Zone": "Gujarat"
  },
  {
    "territory": "Ajmer",
    "region": "Jodhpur",
    "Zone": "Rajasthan"
  },
  {
    "territory": "Kurukshetra",
    "region": "Karnal Region",
    "Zone": "Haryana"
  },
  {
    "territory": "Sangli",
    "region": "Western Maharashtra",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Idar",
    "region": "Ahmedabad",
    "Zone": "Gujarat"
  },
  {
    "territory": "Bankura",
    "region": "Midnapore Region",
    "Zone": "West Bengal"
  },
  {
    "territory": "Bilaspur",
    "region": "Chhattisgarh",
    "Zone": "Chhattisgarh"
  },
  {
    "territory": "Solan",
    "region": "Ludhiana Region",
    "Zone": "Punjab"
  },
  {
    "territory": "Beed",
    "region": "Marathwada",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Gondal",
    "region": "Rajkot",
    "Zone": "Gujarat"
  },
  {
    "territory": "Mansa",
    "region": "Bathinda Region",
    "Zone": "Punjab"
  },
  {
    "territory": "Bodeli",
    "region": "South Gujarat",
    "Zone": "Gujarat"
  },
  {
    "territory": "Tohana",
    "region": "Hissar Region",
    "Zone": "Haryana"
  },
  {
    "territory": "Parbhani",
    "region": "Marathwada",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Surendranagar",
    "region": "Surendranagar",
    "Zone": "Gujarat"
  },
  {
    "territory": "Hanumangarh",
    "region": "Sri Ganganagar",
    "Zone": "Rajasthan"
  },
  {
    "territory": "Hosangabad",
    "region": "Cantral MP",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Guna",
    "region": "Indore",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Shujalpur",
    "region": "Indore",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Bhavnagar",
    "region": "Junagadh",
    "Zone": "Gujarat"
  },
  {
    "territory": "Junagadh",
    "region": "Junagadh",
    "Zone": "Gujarat"
  },
  {
    "territory": "Surat",
    "region": "South Gujarat",
    "Zone": "Gujarat"
  },
  {
    "territory": "Jind",
    "region": "Karnal Region",
    "Zone": "Haryana"
  },
  {
    "territory": "Gorakhpur",
    "region": "Lucknow Region",
    "Zone": "Uttar Pradesh"
  },
  {
    "territory": "Murshidabad",
    "region": "Central Bengal",
    "Zone": "West Bengal"
  },
  {
    "territory": "Halvad",
    "region": "Surendranagar",
    "Zone": "Gujarat"
  },
  {
    "territory": "Wankaner",
    "region": "Surendranagar",
    "Zone": "Gujarat"
  },
  {
    "territory": "Himatnagar",
    "region": "Ahmedabad",
    "Zone": "Gujarat"
  },
  {
    "territory": "Panskura",
    "region": "Midnapore Region",
    "Zone": "West Bengal"
  },
  {
    "territory": "Deesa",
    "region": "Ahmedabad",
    "Zone": "Gujarat"
  },
  {
    "territory": "Kota",
    "region": "Jaipur",
    "Zone": "Rajasthan"
  },
  {
    "territory": "Khandwa",
    "region": "Nimar",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Barpeta",
    "region": "Guwahati",
    "Zone": "Assam"
  },
  {
    "territory": "Satara",
    "region": "Western Maharashtra",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Kolhapur",
    "region": "Western Maharashtra",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Bikaner",
    "region": "Sri Ganganagar",
    "Zone": "Rajasthan"
  },
  {
    "territory": "Bareilly",
    "region": "Ghaziabad Region",
    "Zone": "Uttar Pradesh"
  },
  {
    "territory": "Dhule",
    "region": "Khandesh",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Buldhana",
    "region": "Marathwada",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Dholka",
    "region": "Ahmedabad",
    "Zone": "Gujarat"
  },
  {
    "territory": "Indore",
    "region": "Indore",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Dahod",
    "region": "Central Gujarat",
    "Zone": "Gujarat"
  },
  {
    "territory": "Muzaffarnagar",
    "region": "Ghaziabad Region",
    "Zone": "Uttar Pradesh"
  },
  {
    "territory": "Lucknow",
    "region": "Lucknow Region",
    "Zone": "Uttar Pradesh"
  },
  {
    "territory": "Kharupetia",
    "region": "Guwahati",
    "Zone": "Assam"
  },
  {
    "territory": "Muktsar",
    "region": "Bathinda Region",
    "Zone": "Punjab"
  },
  {
    "territory": "Nashik",
    "region": "Khandesh",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Jorhat",
    "region": "Guwahati",
    "Zone": "Assam"
  },
  {
    "territory": "Keshod",
    "region": "Junagadh",
    "Zone": "Gujarat"
  },
  {
    "territory": "Dewash",
    "region": "Indore",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Narayangaon",
    "region": "Khandesh",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Mahasamund",
    "region": "Chhattisgarh",
    "Zone": "Chhattisgarh"
  },
  {
    "territory": "Durg",
    "region": "Chhattisgarh",
    "Zone": "Chhattisgarh"
  },
  {
    "territory": "Talala",
    "region": "Junagadh",
    "Zone": "Gujarat"
  },
  {
    "territory": "Khargone",
    "region": "Nimar",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Jabalpur",
    "region": "Cantral MP",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Sasaram",
    "region": "North Bihar",
    "Zone": "Bihar"
  },
  {
    "territory": "Jamnagar",
    "region": "Rajkot",
    "Zone": "Gujarat"
  },
  {
    "territory": "Sanawad",
    "region": "Nimar",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Sawai Madhopur",
    "region": "Jaipur",
    "Zone": "Rajasthan"
  },
  {
    "territory": "Prayagraj (Allahabad)",
    "region": "Lucknow Region",
    "Zone": "Uttar Pradesh"
  },
  {
    "territory": "Amreli",
    "region": "Junagadh",
    "Zone": "Gujarat"
  },
  {
    "territory": "Patna",
    "region": "North Bihar",
    "Zone": "Bihar"
  },
  {
    "territory": "Amaravati",
    "region": "Vidharbha",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Motihari",
    "region": "North Bihar",
    "Zone": "Bihar"
  },
  {
    "territory": "Karnal",
    "region": "Karnal Region",
    "Zone": "Haryana"
  },
  {
    "territory": "Jodhpur",
    "region": "Jodhpur",
    "Zone": "Rajasthan"
  },
  {
    "territory": "Midnapore East",
    "region": "Midnapore Region",
    "Zone": "West Bengal"
  },
  {
    "territory": "Dhamtari",
    "region": "Chhattisgarh",
    "Zone": "Chhattisgarh"
  },
  {
    "territory": "Ujjain",
    "region": "Indore",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "24 Parganas South",
    "region": "Central Bengal",
    "Zone": "West Bengal"
  },
  {
    "territory": "Ankleshwar",
    "region": "South Gujarat",
    "Zone": "Gujarat"
  },
  {
    "territory": "Moradabad",
    "region": "Ghaziabad Region",
    "Zone": "Uttar Pradesh"
  },
  {
    "territory": "Shahjahanpur",
    "region": "Ghaziabad Region",
    "Zone": "Uttar Pradesh"
  },
  {
    "territory": "Bhuj",
    "region": "Surendranagar",
    "Zone": "Gujarat"
  },
  {
    "territory": "Bhiwani",
    "region": "Hissar Region",
    "Zone": "Haryana"
  },
  {
    "territory": "Azamgarh",
    "region": "Lucknow Region",
    "Zone": "Uttar Pradesh"
  },
  {
    "territory": "Burdwan West",
    "region": "Burdwan Region",
    "Zone": "West Bengal"
  },
  {
    "territory": "Rudrapur",
    "region": "Ghaziabad Region",
    "Zone": "Uttar Pradesh"
  },
  {
    "territory": "Yavatmal",
    "region": "Vidharbha",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Banswara",
    "region": "Jodhpur",
    "Zone": "Rajasthan"
  },
  {
    "territory": "Midnapore West",
    "region": "Midnapore Region",
    "Zone": "West Bengal"
  },
  {
    "territory": "Chandrapur",
    "region": "Vidharbha",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Botad",
    "region": "Junagadh",
    "Zone": "Gujarat"
  },
  {
    "territory": "Sirsa",
    "region": "Hissar Region",
    "Zone": "Haryana"
  },
  {
    "territory": "Baroda",
    "region": "Central Gujarat",
    "Zone": "Gujarat"
  },
  {
    "territory": "Bhagalpur",
    "region": "North Bihar",
    "Zone": "Bihar"
  },
  {
    "territory": "Muzaffarpur",
    "region": "North Bihar",
    "Zone": "Bihar"
  },
  {
    "territory": "Navsari",
    "region": "South Gujarat",
    "Zone": "Gujarat"
  },
  {
    "territory": "Barwani",
    "region": "Nimar",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Hoogly",
    "region": "Midnapore Region",
    "Zone": "West Bengal"
  },
  {
    "territory": "Baramati",
    "region": "Western Maharashtra",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Madhepura",
    "region": "North Bihar",
    "Zone": "Bihar"
  },
  {
    "territory": "Shivpuri",
    "region": "Indore",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Jamjodhpur",
    "region": "Rajkot",
    "Zone": "Gujarat"
  },
  {
    "territory": "Bhopal",
    "region": "Cantral MP",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Aurangabad",
    "region": "Marathwada",
    "Zone": "Maharashtra"
  },
  {
    "territory": "Palanpur",
    "region": "Ahmedabad",
    "Zone": "Gujarat"
  },
  {
    "territory": "Panipat",
    "region": "Karnal Region",
    "Zone": "Haryana"
  },
  {
    "territory": "Moga",
    "region": "Bathinda Region",
    "Zone": "Punjab"
  },
  {
    "territory": "Mandsaur",
    "region": "Indore",
    "Zone": "Madhya Pradesh"
  },
  {
    "territory": "Jaipur",
    "region": "Jaipur",
    "Zone": "Rajasthan"
  },
  {
    "territory": "Sangrur",
    "region": "Bathinda Region",
    "Zone": "Punjab"
  },
  {
    "territory": "Washim",
    "region": "Marathwada",
    "Zone": "Maharashtra"
  }
];

