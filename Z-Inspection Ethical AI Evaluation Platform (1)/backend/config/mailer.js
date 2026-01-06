const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendVerificationEmail(to, code) {
  console.log("[MAIL] sending to", to);

  await transporter.sendMail({
    from: `"Z-Inspection Platform" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your verification code",
    text: `Your verification code is: ${code}`,
    html: `<p>Your verification code is: <b>${code}</b></p>`,
  });

  console.log("[MAIL] sent to", to);
}

module.exports = transporter;
module.exports.sendVerificationEmail = sendVerificationEmail;

