const uuid = require("uuid");
const fs = require("fs");
const path = require("path");
const config = require("../config/config.json");

module.exports = {
  exportData: async (payload, isExport = false) => {
    console.log("export called");
    fileWritter(payload, isExport);
  }
};

async function fileWritter(payload, isExport = false) {
  let fileName = uuid.v4() + ".csv";
  fs.writeFile(
    path.resolve(
      (isExport
        ? config.watcher.exportDirPath
        : config.watcher.responseDirPath) + fileName
    ),
    payload,
    (err) => {
      if (err) {
        console.log("Error writing to csv file", err);
      } else {
        console.log(`saved as ${fileName}`);
      }
    }
  );
}