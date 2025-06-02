const nodemailer = require('nodemailer');

/**
 * Sends an email using Nodemailer.
 * @param {object} options - Email options.
 * @param {string} options.to - Recipient's email address.
 * @param {string} options.subject - Subject of the email.
 * @param {string} options.text - Plain text body of the email.
 * @param {string} [options.html] - HTML body of the email (optional).
 */
const sendEmail = async (options) => {
    // 1. Create a transporter
    // For development/testing with Ethereal:
    // Obtain credentials from https://ethereal.email/create
    // IMPORTANT: These credentials should ideally come from environment variables in a real app.
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST, // e.g., smtp.ethereal.email
        port: process.env.EMAIL_PORT, // e.g., 587
        auth: {
            user: process.env.EMAIL_USER, // e.g., unique_user@ethereal.email
            pass: process.env.EMAIL_PASS, // e.g., generated_password
        },
        // For Ethereal, TLS is often opportunistic. If you have issues:
        // secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
        // tls: {
        //     rejectUnauthorized: false // Only for dev/Ethereal if self-signed certs issues arise
        // }
    });

    // 2. Define the email options
    const mailOptions = {
        from: `"Free Lunch Eligibility Admin" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`, // Sender address
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html, // Optional HTML version
    };

    // 3. Actually send the email
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s'.green, info.messageId);

        // For Ethereal, log the preview URL
        if (process.env.NODE_ENV === 'development' && nodemailer.getTestMessageUrl(info)) {
            console.log('Preview URL: %s'.blue.underline, nodemailer.getTestMessageUrl(info));
        }
        return info;
    } catch (error) {
        console.error('Error sending email:'.red, error);
        // Depending on how critical email is, you might want to throw the error
        // or handle it gracefully (e.g., log and proceed if reset code can be obtained otherwise for dev)
        throw new Error('Email could not be sent.');
    }
};

module.exports = sendEmail;