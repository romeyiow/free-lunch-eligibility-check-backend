const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    let transporter;

    if (options.useGmail) {
        // --- Gmail Transporter for real admins ---
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            console.error('Gmail credentials (GMAIL_USER, GMAIL_APP_PASSWORD) are not configured in .env file.'.red.bold);
            throw new Error('Server email configuration is incomplete for production use.');
        }
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });
    } else {
        // --- Ethereal Transporter for testing/logging non-existent users ---
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }

    // Define email options
    const mailOptions = {
        from: `"LVCC Free Lunch Admin" <${process.env.EMAIL_FROM || process.env.GMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
    };

    // Send the email
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s'.green, info.messageId);

        // If not using Gmail (i.e., using Ethereal), log the preview URL
        if (!options.useGmail && nodemailer.getTestMessageUrl(info)) {
            console.log('Ethereal Preview URL: %s'.blue.underline, nodemailer.getTestMessageUrl(info));
        }
        return info;
    } catch (error) {
        console.error('Error sending email:'.red, error);
        throw new Error('Email could not be sent.');
    }
};

module.exports = sendEmail;