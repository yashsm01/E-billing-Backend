/**
 * Description: Controller for no auth activity
 * @author Suresh suthar
 * Create Date: 26-Feb-2019
 */

const v = require('node-input-validator');
const msg = require("../../i18n/businessen");
const App_version = require('../../models/').business_app_version;

const no_auth = {

  cmsPage: function (req, res) {
    let pages = [
      {
        'page_type': 'about',
        'page_url': process.env.SITEURL + 'about'
      },
      {
        'page_type': 'contact',
        'page_url': process.env.SITEURL + 'contact'
      },
      {
        'page_type': 'faq',
        'page_url': process.env.SITEURL + 'faq'
      },
      {
        'page_type': 'privacy_policy',
        'page_url': process.env.SITEURL + 'privacy_policy'
      },
      {
        'page_type': 'terms_of_usage',
        'page_url': process.env.SITEURL + 'terms_of_usage'
      }
    ];

    res.status(200).send({ success: 1, "cms_pages": pages });
  },

  forceUpdate: function (req, res) {
    let validator = new v(req.body, {
      app_version: 'required',
      device_type: 'required'
    });

    validator.check().then(function (matched) {
      if (!matched) {
        res.status(200).send({ success: 0, message: validator.errors });
      }
      else {
        let attr = [];
        if (req.body.device_type == 1) {
          attr = [
            ['android_ver', 'latest_ver'],
            ['android_status', 'status']
          ];
        }
        else {
          attr = [
            ['ios_ver', 'latest_ver'],
            ['ios_status', 'status']
          ];
        }
        App_version.findOne({
          attr,
          order: [
            ['id', 'desc']
          ],
          limit: 1
        })
          .then(latestVersion => {
            let response = {};
            if (latestVersion) {
              //Split the current user ver digit from 1.0.0 
              let curVer = req.body.app_version.split('.');
              let curVerLast = curVer[2];
              let curVerFirst = curVer[0] + '.' + curVer[1];
              let latestVer;
              //Split the latest user ver digit from 1.0.0 
              if (req.body.device_type == 1) {
                latestVer = latestVersion.dataValues.android_ver.split('.');
              }
              else {
                latestVer = latestVersion.dataValues.ios_ver.split('.');
              }
              let latestVerLast = latestVer[2];
              let latestVerFirst = latestVer[0] + '.' + latestVer[1];

              //Update is define that new version is available
              //Flag is define that latest version is force update or not
              let status = 1;
              if (req.body.device_type == 1) {
                status = latestVersion.dataValues.android_update;
              } else {
                status = latestVersion.dataValues.ios_update;
              }
              if (status == 1) {

                //Match the parent ver is same or not like (1.0).0 
                if (latestVerFirst == curVerFirst) {

                  //if parent is equal then check the child ver is larger or not than or not like 1.0.(0)
                  if (latestVerLast > curVerLast) {
                    response.update = 1;
                    response.flag = 1;
                  }

                }
                else if (latestVerFirst > curVerFirst) {
                  response.update = 1;
                  response.flag = 1;
                }

                res.status(200).send({ success: 1, 'data': response });
              }
              else {
                //Get The latest force update ver from database
                let wherecond = {};
                if (req.body.device_type == 1) {
                  wherecond = latestVersion.dataValues.android_update = 1
                } else {
                  wherecond = latestVersion.dataValues.ios_update = 1;
                }
                App_version.findOne({
                  attr,
                  order: [
                    ['id', 'desc']
                  ],
                  where: wherecond,
                  limit: 1
                })
                  .then(ForceUpdateLastetVer => {
                    //Split the latest force update ver digit from 1.0.0 
                    let forceVer;
                    if (req.body.device_type == 1) {
                      forceVer = ForceUpdateLastetVer.dataValues.android_ver.split('.');
                    } else {
                      forceVer = ForceUpdateLastetVer.dataValues.ios_ver.split('.');
                    }

                    let forceVerLast = forceVer[2];
                    let forceVerFirst = forceVer[0] + '.' + forceVer[1];

                    if (forceVerFirst == curVerFirst) {
                      if (forceVerLast > curVerLast) {
                        response.update = 1;
                        response.flag = 1;
                      }
                      else if (latestVerFirst == curVerFirst) {
                        if (latestVerLast > curVerLast) {
                          response.update = 1;
                          response.flag = 0;
                        }
                        else {
                          res.status(200).send({ success: 0, message: msg.nolatestver });
                        }
                      }
                      else if (latestVerFirst > curVerFirst) {
                        response.update = 1;
                        response.flag = 0;
                      }
                      else {
                        res.status(200).send({
                          success: 0,
                          message: msg.nolatestver
                        });
                      }
                    }
                    else if (forceVerFirst > curVerFirst) {
                      response.update = 1;
                      response.flag = 1;
                    }
                    else {
                      res.status(200).send({
                        success: 0,
                        message: msg.nolatestver
                      });
                    }
                    res.status(200).send({ success: 1, 'data': response });
                  });
              }
            }
            else {
              res.status(200).send({ success: 0, message: "No Latest Version is avaliable " });
            }
          });
      }
    });
  },
};

module.exports = no_auth;