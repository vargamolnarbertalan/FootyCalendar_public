const nodemailer = require('nodemailer')

async function sendEmail(to, token) {
    // Create a nodemailer transporter using your email service provider's SMTP settings

    return new Promise(async(resolve, reject) => {

        let transporter = nodemailer.createTransport({
            service: 'gmail', // Replace with your email service provider
            auth: {
                user: process.env.EMAIL_USER, // Replace with your email address
                pass: process.env.EMAIL_PW // Replace with your email password
            }
        })

        // Setup email data
        let mailOptions = {
                from: process.env.EMAIL_USER, // Sender address
                to: to, // Recipient address
                subject: 'Footy Calendar password reset', // Subject line
                text: `
            Dear user,
            please follow this link to reset your password:
            ${process.env.EMAIL_LINK}${token}
      
            If you did not request your password to be reset, please contact staff immediately!
            ` // Plain text body
            }
            //console.log(mailOptions)

        // Send email

        await transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return resolve({
                    msg: error.message,
                    status: 492
                })

            } else {
                return resolve({
                    msg: 'If this address is valid, an email containing the link has been sent to it.',
                    status: 200
                })

            }
        })

    })
}

async function sendFeedback(title, content, username) {
    // Create a nodemailer transporter using your email service provider's SMTP settings

    return new Promise(async(resolve, reject) => {

        let transporter = nodemailer.createTransport({
            service: 'gmail', // Replace with your email service provider
            auth: {
                user: process.env.EMAIL_USER, // Replace with your email address
                pass: process.env.EMAIL_PW // Replace with your email password
            }
        })

        // Setup email data
        let mailOptions = {
                from: process.env.EMAIL_USER, // Sender address
                to: process.env.EMAIL_USER, // Recipient address
                subject: 'Feedback / Issue', // Subject line
                text: `
            Title: ${title}

            Message: ${content}
            Sent by: ${username}
            ` // Plain text body
            }
            //console.log(mailOptions)

        // Send email

        await transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return resolve({
                    msg: error.message,
                    status: 492
                })

            } else {
                return resolve({
                    msg: 'Feedback has been sent.',
                    status: 200
                })

            }
        })

    })
}

/////////////////////////////////////////////////////

module.exports = {
    sendEmail,
    sendFeedback
}