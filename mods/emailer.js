const nodemailer = require('nodemailer')

const emailer = (subject, message, to) => {

        return new Promise( (resolve, reject) => {

        var text = `Message: ${message} \n`
        var html = `${message}`

        var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.googleUser,
                pass: process.env.googlePass
            }
        });

        var mailOptions = {
            from: '"Andy Ball" <andy.ball@guardian.co.uk>',
            to: to, // list of receivers
            subject: subject, // Subject line
            text: text, // plain text body
            html: html // html body
        };

        transporter.sendMail(mailOptions, function (err, info) {

            if (err) {

                reject({ status : 'failure' , message : err })

            } else {

                resolve({ status : 'success' })

            }
            
        });

    });

}

module.exports = emailer