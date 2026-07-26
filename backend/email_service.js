const nodemailer = require('nodemailer');

/**
 * Checks if SMTP environment variables are configured.
 * @returns {boolean}
 */
function isSmtpConfigured() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

/**
 * Sends vendor invitation email using nodemailer.
 * @param {Object} params
 * @param {string} params.toEmail - Vendor's email address
 * @param {string} params.generatedPassword - Generated temporary password
 * @param {string} params.portalUrl - Login portal URL
 * @returns {Promise<{ emailSent: boolean, message: string }>}
 */
async function sendVendorInvitation({ toEmail, generatedPassword, portalUrl }) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  console.log(`[INVITATION CREATED] Vendor Email: ${toEmail} | Temporary Password: ${generatedPassword}`);
  console.log(`[SMTP CONFIG CHECK] Host: ${smtpHost || 'NONE'} | Port: ${smtpPort || 'NONE'} | User: ${smtpUser || 'NONE'}`);

  if (!smtpHost || !smtpUser || !smtpPass) {
    return {
      emailSent: false,
      message: 'Vendor user account created, but SMTP is not configured. Credentials printed to server logs.'
    };
  }

  const cleanPass = smtpPass.replace(/\s+/g, '');

  // For Gmail/Google workspace, service: 'gmail' preset avoids cloud host port 587 ETIMEDOUT blocks
  const isGmail = smtpHost.includes('gmail') || smtpUser.includes('gmail') || smtpUser.includes('inteliwaves');
  const transportConfig = isGmail ? {
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: cleanPass
    }
  } : {
    host: smtpHost,
    port: parseInt(smtpPort, 10) || 465,
    secure: (parseInt(smtpPort, 10) || 465) === 465,
    auth: {
      user: smtpUser,
      pass: cleanPass
    },
    tls: {
      rejectUnauthorized: false
    }
  };

  const transporter = nodemailer.createTransport(transportConfig);

  // Optional but very useful in production: verify the SMTP connection/auth
  // before attempting to send, so config problems show up clearly in logs.
  try {
    await transporter.verify();
    console.log(`[SMTP VERIFY OK] Connected to ${isGmail ? 'gmail service' : smtpHost}`);
  } catch (verifyError) {
    console.error('[SMTP VERIFY FAILED]', verifyError.message || verifyError);
    return {
      emailSent: false,
      message: 'Vendor registered, but SMTP connection/auth failed. Check server logs.'
    };
  }

  const mailOptions = {
    from: `"VK18 Vendor Portal" <${smtpUser}>`,
    to: toEmail,
    subject: 'Welcome to VK18 Vendor Portal - Onboarding Invitation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-bottom: 20px;">VK18 Pvt Ltd - Vendor Onboarding</h2>
        <p>Hello,</p>
        <p>You have been invited to register as a partner/vendor on the VK18 Portal.</p>
        <p>Please use the credentials below to log in and fill out the Vendor Registration Form:</p>

        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4f46e5;">
          <p style="margin: 5px 0;"><strong>Portal URL:</strong> <a href="https://vendor-onboarding-phi.vercel.app" style="color: #4f46e5; text-decoration: underline;">https://vendor-onboarding-phi.vercel.app</a></p>
          <p style="margin: 5px 0;"><strong>Username (Email):</strong> <code>${toEmail}</code></p>
          <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code>${generatedPassword}</code></p>
        </div>

        <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
          Note: This is a system generated email. For security reasons, please change your password after logging in.
        </p>
      </div>
    `
  };

  // Awaited dispatch: production now waits for the actual result instead of
  // firing-and-forgetting, which was the main reason emails silently never
  // went out on serverless/auto-scaling hosts (the process/container could
  // be frozen or killed before the background promise resolved).
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL DISPATCHED SUCCESS] Vendor invitation email sent to ${toEmail}. MessageId: ${info.messageId}`);
    return {
      emailSent: true,
      message: 'Vendor registered and invitation email sent.'
    };
  } catch (mailError) {
    console.error(`[SMTP ERROR FAILURE] Failed to send email to ${toEmail}:`, mailError.message || mailError);
    return {
      emailSent: false,
      message: 'Vendor registered, but the invitation email failed to send. Check server logs.'
    };
  }
}

module.exports = {
  isSmtpConfigured,
  sendVendorInvitation
};
