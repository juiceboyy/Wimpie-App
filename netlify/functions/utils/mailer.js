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

async function verstuurExportEmail(toEmail, subject, textBody, filename, base64Data) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: toEmail,
      subject: subject,
      text: textBody,
      attachments: [
        {
          filename: filename,
          content: base64Data,
          encoding: 'base64',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });
    return 'Export mail verstuurd.';
  } catch (error) {
    console.error('Export mail error:', error);
    return 'Export mail mislukt.';
  }
}

module.exports = { verstuurVerslagEmail, verstuurExportEmail };