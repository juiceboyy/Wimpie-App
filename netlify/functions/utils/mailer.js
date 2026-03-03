const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function verstuurVerslagEmail(naam, datum, tekst, email) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: `Verslag Wimpie & de Domino's: ${naam}`,
      text: tekst,
    });
    return 'Mail verstuurd.';
  } catch (error) {
    console.error('Mail error:', error);
    return 'Mail mislukt.';
  }
}

module.exports = { verstuurVerslagEmail };