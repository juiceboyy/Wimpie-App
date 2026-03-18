const archiver = require('archiver');
archiver.registerFormat('zip-encrypted', require('archiver-zip-encrypted'));
const { verstuurExportEmail } = require('./mailer');

async function sendExport(payload) {
  const maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const [jaar, maandNummer] = payload.maand.split('-');
  const maandNaam = maanden[parseInt(maandNummer, 10) - 1];

  let targetEmail = '';
  let orgNaam = '';
  if (payload.organisatie === 'amsta') {
    targetEmail = 'crediteuren@amsta.nl';
    orgNaam = 'AMSTA';
  } else {
    // Fallback / Standaard is Cordaan
    targetEmail = 'declaratieonderaannemers@cordaan.nl';
    orgNaam = 'Cordaan';
  }

  const toEmail = targetEmail;
  const ccEmail = 'auckboersma@gmail.com';

  const subject = 'Declaratiebestand ' + payload.filename;
  let textBody = `Beste urenadministratie,\n\nIn de bijlage sturen wij het ingevulde uren-importbestand van Wimpie & de Domino's over de maand ${maandNaam} ${jaar}.\n\nHet betreft de geleverde muziekdagbesteding voor onze deelnemers via ${orgNaam}.`;

  if (payload.organisatie === 'amsta') {
    textBody += `\n\nLet op: in verband met de AVG en privacy is de bijlage veilig ingepakt in een versleuteld ZIP-bestand. U ontvangt het benodigde wachtwoord om dit bestand te openen direct hierna in een aparte e-mail.`;
  }

  textBody += `\n\nGraag ontvangen wij een akkoord op deze uren, zodat wij de factuur volgens protocol kunnen indienen.\n\nMochten er onduidelijkheden zijn, dan hoor ik het graag.\n\nMet vriendelijke groet,\nRonald van Holst / Auck Boersma\nWimpie & de Domino's`;

  if (payload.organisatie === 'amsta') {
    const password = 'AMSTA-' + Math.floor(1000 + Math.random() * 9000);
    const zipBase64 = await createEncryptedZip(payload.base64Data, payload.filename, password);
    const zipFilename = payload.filename.replace('.xlsx', '.zip');

    // Mail 1: ZIP
    await verstuurExportEmail(toEmail, ccEmail, subject, textBody, zipFilename, zipBase64);

    // Mail 2: Wachtwoord
    const passwordBody = `Beste urenadministratie,\n\nHet wachtwoord voor het beveiligde ZIP-bestand van de zojuist verzonden declaratie is: ${password}\n\nMet vriendelijke groet.`;
    await verstuurExportEmail(toEmail, ccEmail, 'Wachtwoord declaratiebestand', passwordBody, null, null);
  } else {
    await verstuurExportEmail(toEmail, ccEmail, subject, textBody, payload.filename, payload.base64Data);
  }

  return { message: 'Export succesvol verzonden.' };
}

function createEncryptedZip(base64Data, filename, password) {
  return new Promise((resolve, reject) => {
    const archive = archiver.create('zip-encrypted', { zlib: { level: 8 }, encryptionMethod: 'aes256', password: password });
    const buffers = [];

    archive.on('data', data => buffers.push(data));
    archive.on('end', () => resolve(Buffer.concat(buffers).toString('base64')));
    archive.on('error', err => reject(err));

    const buffer = Buffer.from(base64Data, 'base64');
    archive.append(buffer, { name: filename });
    archive.finalize();
  });
}

module.exports = { sendExport };