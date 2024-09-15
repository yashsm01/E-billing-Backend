const cron = require('node-cron');
const request = require('request');
const mailer = require('../../mail');
const pdf = require('html-pdf');
const ejs = require('ejs');
const moment = require('moment');
const path = require('path')
const fs = require('fs');

module.exports = {
  executeEveryHour: async () => {
    try {
      let dates = [moment(new Date()).format('YYYY-MM-DD')];

      let logs = {};

      for (let i = 0; i < dates.length; i++) {
        logs = Object.assign(logs, await getLogs(dates[i]));
      }

      console.log('Log founded : ', logs);
      logs = logs[dates[0]];
      console.log('dates: ', dates[0]);
      console.log('log: ', logs);

      console.log('Log filtering start');
      let filterlogs = await logs.filter(item => {
        return new Date(item.time) >= new Date(moment(new Date()).subtract(1, 'hours'));
      });

      console.log('Log filtered : ', filterlogs);
      if (filterlogs.length > 0) {

        console.log('Process start to make pdf');
        if (filterlogs.length > 0) {
          let html = await generateHTML(path.join(global.rootPath, 'templates', 'email', 'error-logs.html'), {
            company: 'Mahendra Summit',
            key: dates[0],
            errors: filterlogs
          });
          let bufferPDF = await generatePDF(html);

          console.log('Pdf generated!')
          console.log('buffer string ', bufferPDF);

          console.log('mail sending.....');
          await sendMail({
            to_email: ['rajan@trusttags.in', 'rajiv@trusttags.in'],
            subject: 'Hourly Error Report of Mahendra Summit - ' + dates[0],
            email_content: `Hello Team, <br> This is auto generated mail, please find attachment of error report of last hour!
                  <br><br><br>
                  Regards,<br>Trusttags Support`,
            attachments: [{   // binary buffer as an attachment
              filename: `hourly-error-report-${dates[0]}.pdf`,
              content: new Buffer(bufferPDF, 'base64')
            }]
          }, true)

          console.log('mail has sent successfully!');
        }
      }
    } catch (error) {
      console.error('Get error while getting logs: ', error);
    }
  },
  FetchErrorLogs: async function (config) {
    try {

      cron.schedule('15 18 * * *', function () {
        request.get({
          "url": config.APIURL,
          "headers": { "content-type": "application/json", "x-access-token": "122loggertoken@TT" },

        }, async (error, response, body) => {
          if (error) {
            return console.dir(error);
          }

          body = JSON.parse(body).data;
          let key = Object.keys(body)[0];

          if (body[key].length > 0 && config.allowToSendMail) {
            let html = await generateHTML(path.join(global.rootPath, 'templates', 'email', 'error-logs.html'), {
              company: 'VLCC',
              key: key,
              errors: body[key]
            });
            let bufferPDF = await generatePDF(html);

            console.log('buffer string ', bufferPDF);

            sendMail({
              to_email: ['rajan@trusttags.in', 'rajiv@trusttags.in'],
              subject: 'Error Report of VLCC - ' + key,
              email_content: `Hello Team, <br> This is auto generated mail, please find attachment of error report of today!
                          <br><br><br>
                          Regards,<br>Trusttags Support`,
              attachments: [{   // binary buffer as an attachment
                filename: `error-report-${key}.pdf`,
                content: new Buffer(bufferPDF, 'base64')
              }]
            }, true)
          }
        });

      });
    } catch (error) {
      console.error(error);
    }
  }
};

async function generateHTML(template, data) {
  let html = await ejs.renderFile(template, {
    data: data
  });

  return html;
}

async function generatePDF(html) {
  return new Promise((resolve, reject) => {
    pdf.create(html).toBuffer((err, buffer) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(buffer);
      }
    });
  });
}

async function sendMail(data, attachment = false) {
  if (attachment) {
    console.log('sending email with attachment')
    mailer.sendMailWithAttachments(data);
  } else {
    console.log('sending email without attachment')
    mailer.sendMail(data);
  }
}

async function getDates(startDate, endDate) {
  startDate = moment(startDate);
  endDate = moment(endDate);
  let diff = await endDate.diff(startDate, 'days');
  console.log('diff - ', diff);
  let dates = [startDate.format('YYYY-MM-DD')];
  for (let i = 0; i < diff; i++) {
    dates.push(startDate.add(1, 'days').format('YYYY-MM-DD'))
  }

  return dates;
}

async function getLogs(filename) {
  let filePath = path.join(global.rootPath, 'logs', 'errors', filename + '.json');
  console.log(filePath);
  if (fs.existsSync(filePath)) {
    console.log('exists');
    return {
      [filename]: JSON.parse(fs.readFileSync(filePath).toString())
    }
  } else {
    console.log('file not fount')
    return { [filename]: [] };
  }
}
