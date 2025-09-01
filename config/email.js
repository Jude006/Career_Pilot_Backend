// const nodemailer = require('nodemailer');

// const sendEmail = async (options) => {
//   // Create reusable transporter object using SMTP transport
//   const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST || 'smtp.gmail.com',
//     port: process.env.SMTP_PORT || 587, // Use 587 instead of 465
//     secure: false, // true for 465, false for other ports
//     auth: {
//       user: process.env.SMTP_EMAIL,
//       pass: process.env.SMTP_PASSWORD,
//     },
//   });

//   // Define email options
//   const mailOptions = {
//     from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
//     to: options.email,
//     subject: options.subject,
//     text: options.message,
//   };

//   try {
//     await transporter.sendMail(mailOptions);
//   } catch (err) {
//     console.error('Email send error:', err);
//     throw new Error('Email could not be sent');
//   }
// };

// module.exports = sendEmail;


const nodemailer = require('nodemailer');
require('dotenv').config()

const sendEmail = async (options) => {
  // 1. Create transporter using Gmail service
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_EMAIL, // Your Gmail address
      pass: process.env.SMTP_PASSWORD // Your App Password (not your regular Gmail password)
    },
    tls: {
      rejectUnauthorized: false // For local development only - remove in production
    }
  });

  // 2. Define email options
  const mailOptions = {
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: `<p>${options.message}</p>`
  };

  // 3. Send email
  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};

module.exports = sendEmail;