const axios = require('axios');
const https = require('https');
const uuid = require('uuid');
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});
//models
const models = require('./_models');
const cmsOrderModel = require("../models/").cms_uploads;
const companyUserHistoryModels = require("../models/").company_users_history;
axios.defaults.httpsAgent = httpsAgent;
axios.defaults.baseURL = "http://localhost:3001";
const DynamicModel = require("../models/dynamic_models");
const sequelize = require("sequelize");
const { Op } = require("sequelize");
var randomstring = require("randomstring");
const path = require("path");
const order = require('./order');


const getproducts = async (req, res) => {
  try {
    let firstPage = Number(req.body.firstPage);
    let lastPage = Number(req.body.lastPage);
    let productCount = Number(req.body.productCount)
    let alphabet = req.body.alphabet;
    let perpage = 30;
    let category = await models.categoryModel.findAll({ attributes: ['name', 'id'], raw: true });
    let company = await models.companiesModel.findAll({ attributes: ['name', 'id'], raw: true });

    for (let page = firstPage; page <= lastPage; page++) {
      console.log(">>>>>>>>Page no: ", page)
      let oldUrl = `https://www.1mg.com/pharmacy_api_gateway/v4/drug_skus/by_prefix?prefix_term=${alphabet}&page=${page}&per_page=${perpage}`;
      axios.defaults.baseURL = oldUrl;

      let productList = await axios.get();
      console.log(productList);
      for (let x = productCount; x < productList.data.data.skus.length; x++) {
        console.log(`>>>count:${x}, Page: ${page}`, x)
        const product = productList.data.data.skus[x];
        let productId = uuid();
        let imageURL = '';
        if (product.image_url == 'https://onemg.gumlet.io/a_ignore,w_380,h_380,c_fit,q_auto,f_auto/hx2gxivwmeoxxxsc1hix.png') {
          imageURL = "https://lifestyle-dev-tt.s3.amazonaws.com/EBilling/product-image/c571bbc1-6ed5-41bd-adf0-836c6864fb62.png";
        }
        else if (product.image_url) {
          const response1 = await axios.get(`${product.image_url}`, {
            responseType: 'arraybuffer'
          });
          const imageDataBuffer = Buffer.from(response1.data);
          const fileExtension = path.extname(product.image_url);
          const fileName = productId + fileExtension;
          let contentType = await getContentType(fileName);
          const compressedImageBuffer = await compressImage(response1.data, fileExtension);
          const params = {
            Bucket: `${global.config.storage.name}/product-image`,
            Key: fileName,
            Body: compressedImageBuffer,
            ContentType: contentType,
            ContentDisposition: 'inline'
          };
          let response = await global.s3.upload(params).promise();
          imageURL = response.Location;
        }
        else {
          imageURL = "https://lifestyle-dev-tt.s3.amazonaws.com/EBilling/product-image/c571bbc1-6ed5-41bd-adf0-836c6864fb62.png";
        }

        //category insert or update
        let categoryData = { name: product.type };
        let categoryDetail = {};
        if (category.filter(x => x.name == categoryData.name).length == 0) {
          let newData = await addCategory(categoryData);
          category.push(newData);
        } else {
          categoryDetail = category.find(x => x.name == categoryData.name);
        }

        //company insert or update
        let companyData = { name: product.manufacturer_name };
        let companyDetail = {};
        if (company.filter(x => x.name == companyData.name).length == 0) {
          let newData = await addcompany(companyData);
          company.push(newData);
        } else {
          companyDetail = company.find(x => x.name == companyDetail.name);
        }

        let uoms = determineUom(product.pack_size_label);

        let prodDetails = {
          id: productId,
          name: product.name,
          image: imageURL,
          hsn_code: "",
          salt: "-",
          dosage_type: "",
          content: product.short_composition,
          packing_size: uoms.status ? product.quantity : 1,
          unit_size: product.quantity,
          uom: uoms.uom,
          description: product.short_composition,
          category: categoryDetail.id,
          company_id: companyDetail.id,
        };
        let info = await models.productsModel.create(prodDetails, {
          where: {
            id: productId
          }
        });
      }
    }


  } catch (error) {
    console.log(error);
    return res.status(200).send({ success: 0, message: "Something went wrong!" });
  }
}

async function addCategory(data) {
  let maxcount = await models.categoryModel.findOne({ order: [['id', 'DESC']], attributes: ['id'], raw: true });
  let info = {
    id: Number(maxcount.id) + 1,
    name: data.name,
    status: true
  };
  await models.categoryModel.create(info);
  return info;
}

async function addcompany(data) {
  let companyId = uuid();
  let info = {
    id: companyId,
    name: data.name
  };
  await models.companiesModel.create(info);
  return info;
}



function determineUom(packSizeLabel) {
  // Convert the label to lowercase to handle case insensitivity
  const lowerCaseLabel = packSizeLabel.toLowerCase();

  // Check for tablets or capsules
  if (lowerCaseLabel.includes("kit") || lowerCaseLabel.includes("kits")) {
    return { uom: "Kits", status: true };
  }
  // Check for tablets or capsules
  if (lowerCaseLabel.includes("inhalers") || lowerCaseLabel.includes("inhaler")) {
    return { uom: "Inhalers", status: true };
  }
  if (lowerCaseLabel.includes("strips") || lowerCaseLabel.includes("strip")) {
    return { uom: "Strips", status: true };
  }
  if (lowerCaseLabel.includes("capsules") || lowerCaseLabel.includes("capsule")) {
    return { uom: "Capsules", status: true };
  }
  if (lowerCaseLabel.includes("tablets") || lowerCaseLabel.includes("tablet")) {
    return { uom: "Tablets", status: true };
  }
  // Check for Injection
  else if (lowerCaseLabel.includes("injection") || lowerCaseLabel.includes("injections")) {
    return { uom: "Injections", status: true };
  }
  // Check for ml
  else if (lowerCaseLabel.includes("ml")) {
    return { uom: "Ml", status: true };
  }
  // Check for gm
  else if (lowerCaseLabel.includes("gm")) {
    return { uom: "Gm", status: true };
  }
  // Check for kg
  else if (lowerCaseLabel.includes("kg")) {
    return { uom: "Kg", status: true };
  }
  // Check for ltr
  else if (lowerCaseLabel.includes("ltr")) {
    return { uom: "Ltr", status: true };
  }

  // Default return value if none of the conditions match
  return { uom: "Tablets", status: true };
}

async function getContentType(fileName) {
  const extension = fileName.split('.').pop().toLowerCase();
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    default:
      return 'application/octet-stream'; // Default content type for unknown file types
  }
};


async function compressImage(imageBuffer, fileExtension) {
  try {

    // console.log("fileExtension>>>>>>>", fileExtension)
    if (fileExtension === '.pdf' || fileExtension === '.PDF') {
      console.log("return")
      return imageBuffer;
    }

    return imageBuffer;
  } catch (error) {
    throw new Error('Error compressing image: ' + error);
  }
};

module.exports = {
  getproducts
}