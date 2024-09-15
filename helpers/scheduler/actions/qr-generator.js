const logger = require('../../logger');
// const ShipperPendingModel = require('../../../models/').parent_qrcodes_pending;
const FstLvlInnerModel = require('../../../models/').fst_lvl_qrcode;
const FstLvlInnerPendingModel = require('../../../models/').fst_lvl_qrcode_pending;
const SndLvlInnerModel = require('../../../models/').snd_lvl_qrcode;
const SndLvlInnerPendingModel = require('../../../models/').snd_lvl_qrcode_pending;

const FstLvlParentModel = require('../../../models/').fst_lvl_qrcode_parent;
const SndLvlParentModel = require('../../../models/').snd_lvl_qrcode_parent;
const ParentQRcodeMstModel = require('../../../models/').parent_qrcode_master;

const ShipperModel = require('../../../models/').parent_qrcodes;
const ProductModel = require('../../../models').products;
const ProductBatchModel = require('../../../models').product_batches;
const uuid = require("uuid");
const QRCode = require("qrcode");
const pathModule = require('path');
const moment = require('moment');

// ProductModel.hasMany(ShipperPendingModel, {
//     foreignKey: 'product_id'
// });
// ShipperPendingModel.belongsTo(ProductModel, {
//     foreignKey: 'product_id'
// });

// ProductModel.hasMany(ParentQRcodeMstModel, {
//     foreignKey: 'product_id'
// });
// ParentQRcodeMstModel.belongsTo(ProductModel, {
//     foreignKey: 'product_id'
// });

// ProductModel.hasMany(FstLvlParentModel, {
//     foreignKey: 'product_id'
// });
// FstLvlParentModel.belongsTo(ProductModel, {
//     foreignKey: 'product_id'
// });

// ProductModel.hasMany(SndLvlParentModel, {
//     foreignKey: 'product_id'
// });
// SndLvlParentModel.belongsTo(ProductModel, {
//     foreignKey: 'product_id'
// });

// ProductBatchModel.hasMany(FstLvlInnerModel, {
//     foreignKey: 'batch_id'
// });
// FstLvlInnerModel.belongsTo(ProductBatchModel, {
//     foreignKey: 'batch_id'
// });

// ProductBatchModel.hasMany(SndLvlInnerModel, {
//     foreignKey: 'batch_id'
// });
// SndLvlInnerModel.belongsTo(ProductBatchModel, {
//     foreignKey: 'batch_id'
// });

// ProductBatchModel.hasMany(ShipperPendingModel, {
//     foreignKey: 'batch_id'
// });
// ShipperPendingModel.belongsTo(ProductBatchModel, {
//     foreignKey: 'batch_id'
// });

// ProductModel.hasMany(FstLvlInnerPendingModel, {
//     foreignKey: 'product_id'
// });
// FstLvlInnerPendingModel.belongsTo(ProductModel, {
//     foreignKey: 'product_id'
// });

// ProductBatchModel.hasMany(FstLvlInnerPendingModel, {
//     foreignKey: 'batch_id'
// });
// FstLvlInnerPendingModel.belongsTo(ProductBatchModel, {
//     foreignKey: 'batch_id'
// });

// ProductModel.hasMany(SndLvlInnerPendingModel, {
//     foreignKey: 'product_id'
// });
// SndLvlInnerPendingModel.belongsTo(ProductModel, {
//     foreignKey: 'product_id'
// });

// ProductBatchModel.hasMany(SndLvlInnerPendingModel, {
//     foreignKey: 'batch_id'
// });
// SndLvlInnerPendingModel.belongsTo(ProductBatchModel, {
//     foreignKey: 'batch_id'
// });

var isAllowFirstInner = true;
var isAllowSecondInner = true;
var isAllowShipper = true;

let fn = {
    generateShipperQRCodes: async () => {
        console.log('generateShipperQRCodes called');
        try {

            if (isAllowShipper) {
                isAllowShipper = false;
                let pendingInfo;

                pendingInfo = await ShipperPendingModel.findOne({
                    where: {
                        is_generated: false
                    },
                    include: [{
                        model: ProductModel,
                        attributes: ['u_id', 'gtin']
                    }, {
                        model: ProductBatchModel,
                        attributes: ['batch_no', ['manufacturing_date', 'mfgDate'], 'expiry_date']
                    }],
                    order: [
                        ["createdAt", "ASC"]
                    ],
                    raw: true,
                    nest: true
                });

                console.log('pending generated shipper info: ', pendingInfo)

                if (pendingInfo) {
                    await genShipperQRCodes(pendingInfo);
                    isAllowShipper = true;
                    await fn.generateShipperQRCodes();
                } else {
                    isAllowShipper = true;
                }
                // }
            }
        } catch (error) {
		isAllowShipper = true;
            console.error(error);
            logger.error({
                body: {}
            }, error.message);
        }
    },
    generateFstLvlQRCode: async () => {
        console.log('generateFstLvlQRCode called');
        try {

            if (isAllowFirstInner) {
                isAllowFirstInner = false;
                let pendingInfo;

                pendingInfo = await FstLvlInnerPendingModel.findOne({
                    where: {
                        is_generated: false
                    },
                    include: [{
                        model: ProductModel,
                        attributes: ['u_id', 'gtin']
                    }, {
                        model: ProductBatchModel,
                        attributes: ['batch_no', ['manufacturing_date', 'mfgDate'], 'expiry_date']
                    }],
                    order: [
                        ["createdAt", "ASC"]
                    ],
                    raw: true,
                    nest: true
                });

                console.log('fst pendingInfo -->', pendingInfo);

                if (pendingInfo) {
                    await genFstInnerCode(pendingInfo);
                    isAllowFirstInner = true;
                    await fn.generateFstLvlQRCode();
                } else {
                    isAllowFirstInner = true;
                }
            }
            // }
        } catch (error) {
		isAllowFirstInner = true;
            console.error(error);
            logger.error({
                body: {}
            }, error.message);
        }
    },
    generateSndLvlQRCode: async () => {
        console.log('generateSndLvlQRCode called');
        try {

            if (isAllowSecondInner) {
                isAllowSecondInner = false;
                let pendingInfo;

                pendingInfo = await SndLvlInnerPendingModel.findOne({
                    where: {
                        is_generated: false
                    },
                    include: [{
                        model: ProductModel,
                        attributes: ['u_id', 'gtin']
                    }, {
                        model: ProductBatchModel,
                        attributes: ['batch_no', ['manufacturing_date', 'mfgDate'], 'expiry_date']
                    }],
                    order: [
                        ["createdAt", "ASC"]
                    ],
                    nest: true,
                    raw: true
                });

                if (pendingInfo) {
                    await genSndInnerCode(pendingInfo);
                    isAllowSecondInner = true;
                    await fn.generateSndLvlQRCode();
                } else {
                    isAllowSecondInner = true;
                }
                // }
            }
        } catch (error) {
		isAllowSecondInner = true;
            console.error(error);
            logger.error({
                body: {}
            }, error.message);
        }
    }
}

async function genSndInnerCode(info) {
    let lastCode = await SndLvlInnerModel.findOne({
        attributes: ["unique_qrcode", 'batch_id'],
        where: {
            product_id: info.product_id,
        },
        order: [
            ["created_timestamp", "DESC"]
        ],
        raw: true,
        nest: true
    });

    if (!lastCode) {
        lastCode = "0"
    } else {
        lastCode = lastCode.unique_qrcode.toString().substr(6);
    }

    let qr_code;
    var innerQRcodes = [];
    let innerQRCodeRes;
    let parentRefId = uuid.v4();
    for (let j = 0; j < info.total; j++) {
        await sleep(15);
        lastCode = await ((parseInt(lastCode, 36) + 1).toString(36)).replace(/0/g, 'A').toUpperCase();

        qr_code = `WW${info.product.u_id}3${lastCode}`;

        let innerCode = {
            id: "'" + uuid.v4() + "'",
            random_id: info.random_id,
            product_id: info.product_id,
            batch_id: info.batch_id,
            unique_qrcode: qr_code,
            user_id: info.user_id,
            created_timestamp: await new Date().getTime(),
            parent_ref_id: parentRefId
        };

        innerQRcodes.push(innerCode);

        if (j != 0 && j % 1000 == 0) {
            innerQRCodeRes = await SndLvlInnerModel.bulkCreate(innerQRcodes, {
                returning: true,
            });
            innerQRcodes.length = 0;
        }
    }

    if (innerQRcodes.length > 0) {
        innerQRCodeRes = await SndLvlInnerModel.bulkCreate(innerQRcodes, {
            returning: true,
        });
    }

    console.log('Bulk inserted done!');

    await SndLvlParentModel.create({
        id: parentRefId,
        total_codes: info.total,
        product_id: info.product_id,
        created_by: info.user_id
    });

    // Generate shipper qr code images
    generateSndInnerQRCodeImage(innerQRcodes, info.product_batch.batch_no, info.product_batch.mfgDate, info.product_batch.expiry_date, info.product.gtin);
    console.log('QR code images done!');

    // Delete record after generate shipper QR codes
    await SndLvlInnerPendingModel.destroy({
        where: {
            id: info.id
        }
    });

    console.log('Generated record deleted!')

    return innerQRCodeRes;
}

async function genFstInnerCode(info) {
    let lastCode = await FstLvlInnerModel.findOne({
        attributes: ["unique_qrcode"],
        where: {
            product_id: info.product_id,
        },
        order: [
            ["created_timestamp", "DESC"]
        ],
        raw: true,
        nest: true
    });

    if (!lastCode) {
        lastCode = "0" // after 19 we get 1A
    } else {
        lastCode = lastCode.unique_qrcode.toString().substr(6);
    }

    let qr_code;
    var innerQRcodes = [];
    let innerQRCodeRes;

    console.log('info total - ', info.total);
    let parentRefId = uuid.v4();
    for (let j = 0; j < info.total; j++) {
        await sleep(15);
        lastCode = await ((parseInt(lastCode, 36) + 1).toString(36)).replace(/0/g, 'A').toUpperCase();

        qr_code = `WW${info.product.u_id}2${lastCode}`;

        let innerCode = {
            id: "'" + uuid.v4() + "'",
            random_id: info.random_id,
            product_id: info.product_id,
            batch_id: info.batch_id,
            unique_qrcode: qr_code,
            user_id: info.user_id,
            created_timestamp: await new Date().getTime(),
            parent_ref_id: parentRefId
        };

        innerQRcodes.push(innerCode);

        if (j != 0 && j % 1000 == 0) {
            console.log('********************', innerQRcodes.length);
            innerQRCodeRes = await FstLvlInnerModel.bulkCreate(innerQRcodes, {
                returning: true,
            });
            innerQRcodes.length = 0;
        }
    }

    console.log('innner code: ', innerQRcodes)

    if (innerQRcodes.length > 0) {
        console.log('---------', innerQRcodes.length);
        innerQRCodeRes = await FstLvlInnerModel.bulkCreate(innerQRcodes, {
            returning: true,
        });
    }

    await FstLvlParentModel.create({
        id: parentRefId,
        total_codes: info.total,
        product_id: info.product_id,
        created_by: info.user_id
    });

    console.log('Bulk inserted done!', innerQRCodeRes.length);

    // Generate shipper qr code images
    await generateFstInnerQRCodeImage(innerQRcodes, info.product_batch.batch_no, info.product_batch.mfgDate, info.product_batch.expiry_date, info.product.gtin);
    console.log('QR code images done!');

    // Delete record after generate shipper QR codes
    await FstLvlInnerPendingModel.destroy({
        where: {
            id: info.id
        }
    });

    console.log('Generated record deleted!')

    return innerQRCodeRes;
}

async function genShipperQRCodes(info) {
    let lastshippercode = await ShipperModel.findOne({
        attributes: ["unique_code"],
        where: {
            product_id: info.product_id,
        },
        order: [
            ["created_timestamp", "DESC"]
        ],
        raw: true,
        nest: true
    });

    if (!lastshippercode) {
        lastshippercode = "0"
    } else {
        lastshippercode = lastshippercode.unique_code.toString().substr(6);
    }

    let qr_code;
    var shipperQrcode = [];
    let shipperQrcodeRes;
    let parentRefId = uuid.v4();
    for (let j = 0; j < info.total; j++) {
        await sleep(15);
        lastshippercode = await ((parseInt(lastshippercode, 36) + 1).toString(36)).replace(/0/g, 'A').toUpperCase();

        qr_code = `WW${info.product.u_id}4${lastshippercode}`;

        let shipperCode = {
            id: "'" + uuid.v4() + "'",
            random_id: info.random_id,
            product_id: info.product_id,
            batch_id: info.batch_id,
            unique_code: qr_code,
            user_id: info.user_id,
            created_timestamp: await new Date().getTime(),
            parent_ref_id: parentRefId,
            gross_weight: info.gross_weight

        };

        shipperQrcode.push(shipperCode);

        if (j != 0 && j % 1000 == 0) {
            shipperQrcodeRes = await ShipperModel.bulkCreate(shipperQrcode, {
                returning: true,
            });
            shipperQrcode.length = 0;
        }
    }

    if (shipperQrcode.length > 0) {
        shipperQrcodeRes = await ShipperModel.bulkCreate(shipperQrcode, {
            returning: true,
        });
    }

    await ParentQRcodeMstModel.create({
        id: parentRefId,
        total_codes: info.total,
        product_id: info.product_id,
        created_by: info.user_id
    });

    console.log('Bulk inserted done!', info);

    // Generate shipper qr code images
    generateShipperQRCodeImage(shipperQrcode, info.product_batch.batch_no, info.product_batch.mfgDate, info.product_batch.expiry_date, info.product.gtin);
    console.log('QR code images done!');

    // Delete record after generate shipper QR codes
    await ShipperPendingModel.destroy({
        where: {
            id: info.id
        }
    });

    console.log('Generated record deleted!')

    return shipperQrcodeRes;
}

async function generateSndInnerQRCodeImage(info, batchNo, mfgDate, expDate, gtin, s = 0) {
    await QRCode.toFile(
        pathModule.join(global.rootPath, "public/snd_inner_code_images", info[s].id.replace(/'/g, '') + ".png"),
        `${(gtin) ? gtin.toUpperCase() : 'UID' + info[s].unique_qrcode} B.NO ${batchNo} MFG DT ${moment(new Date(mfgDate)).format("DD-MMM-YY").toUpperCase()} EXP DT ${moment(new Date(expDate)).format("DD-MMM-YY").toUpperCase()} www.ttags.in/${info[s].unique_qrcode}`,
    );


    if (s == info.length - 1) {
        return true;
    } else if (s % 400 == 0) {
        s++;
        setTimeout(() => {
            generateSndInnerQRCodeImage(info, batchNo, mfgDate, expDate, gtin, s);
        }, 3000);
    } else {
        s++;
        generateSndInnerQRCodeImage(info, batchNo, mfgDate, expDate, gtin, s);
    }
}

async function generateFstInnerQRCodeImage(info, batchNo, mfgDate, expDate, gtin, s = 0) {
    await QRCode.toFile(
        pathModule.join(global.rootPath, "public/fst_inner_code_images", info[s].id.replace(/'/g, '') + ".png"),
        `${(gtin) ? gtin.toUpperCase() : 'UID' + info[s].unique_qrcode}  B.NO ${batchNo} MFG DT ${moment(new Date(mfgDate)).format("DD-MMM-YY").toUpperCase()} EXP DT ${moment(new Date(expDate)).format("DD-MMM-YY").toUpperCase()} www.ttags.in/${info[s].unique_qrcode}`,
    );

    if (s == info.length - 1) {
        return true;
    } else if (s % 400 == 0) {
        s++;
        setTimeout(() => {
            generateFstInnerQRCodeImage(info, batchNo, mfgDate, expDate, gtin, s);
        }, 3000);
    } else {
        s++;
        generateFstInnerQRCodeImage(info, batchNo, mfgDate, expDate, gtin, s);
    }
}


async function generateShipperQRCodeImage(info, batchNo, mfgDate, expDate, gtin, s = 0) {
    console.log('mfg date: ', mfgDate, new Date(mfgDate))
    console.log('exp date: ', expDate, new Date(expDate))
    await QRCode.toFile(
        pathModule.join(global.rootPath, "public/parent_code_images", info[s].id.replace(/'/g, '') + ".png"),
        `${(gtin) ? gtin.toUpperCase() : 'UID' + info[s].unique_code}  B.NO ${batchNo} MFG DT ${moment(new Date(mfgDate)).format("DD-MMM-YY").toUpperCase()} EXP DT ${moment(new Date(expDate)).format("DD-MMM-YY").toUpperCase()} www.ttags.in/${info[s].unique_code}`,
        function (err) {}
    );

    if (s == info.length - 1) {
        return true;
    } else if (s % 400 == 0) {
        s++;
        setTimeout(() => {
            generateShipperQRCodeImage(info, batchNo, mfgDate, expDate, gtin, s);
        }, 3000);
    } else {
        s++;
        generateShipperQRCodeImage(info, batchNo, mfgDate, expDate, gtin, s);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


module.exports = fn;
