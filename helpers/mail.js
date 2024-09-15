const nodemailer = require('nodemailer');

let mails = {

  sendMailWithAttachments: async (data) => {

    let transporter = nodemailer.createTransport({
      host: "smtp.trusttags.in",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: 'support@trusttags.in',
        pass: 'Trusttags@123'
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    let mailOptions = {
      from: 'TrustTags <support@trusttags.in>',
      to: data.to_email,
      cc: data.to_cc_email,
      subject: data.subject,
      html: data.email_content,
      attachments: data.attachments
      //    [{
      //    filename: 'cat1.jpg',
      //    path: './images/cat1.jpg' // stream this file
      //}]
    };

    let info = await transporter.sendMail(mailOptions);
    return info;

    //let info = '';
    //try {

    //} catch (ex) {
    //    console.log(ex.message);
    //    return info;
    //}

  },

  sendMail: async (data, attachment = false) => {
    try {
      let transporter = nodemailer.createTransport({
        host: global.config.mail.host,
        port: global.config.mail.port,
        secure: false, // true for 465, false for other ports
        auth: {
          user: global.config.mail.user,
          pass: global.config.mail.pass
        },
        tls: {
          rejectUnauthorized: false
        }
      });


      let mailOptions = {
        from: 'TrustTags<support@trusttags.in>',
        // to: "kapiltrusttags@gmail.com",
        to: data.to_email,
        subject: data.subject,
        html: data.email_content
        /*template:'../templates/sample.html'*/
      };

      if (attachment) {
        mailOptions.attachments = [
          {
            filename: attachment.fileName,
            content: attachment.content
          }
        ]
      }
      console.log("mailOptions::", mailOptions);
      let info = await transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error(error)
    }
  }

};

module.exports = mails;
