// Sends real emails via Resend (resend.com) when RESEND_API_KEY is set.
// Without a key (e.g. local testing), it just logs the email to the
// console instead of failing, so signup/login/reset still work locally.
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.EMAIL_FROM || 'Kaya Lounge <onboarding@resend.dev>';

async function sendEmail(to, subject, html){
  if(!RESEND_API_KEY){
    console.log(`[email] RESEND_API_KEY not set — would have sent to ${to}: "${subject}"\n${html}`);
    return;
  }
  try{
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html })
    });
    if(!res.ok){
      console.error('Failed to send email:', res.status, await res.text());
    }
  }catch(err){
    console.error('Failed to send email:', err.message);
  }
}

function wrap(bodyHtml){
  return `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;background:#1a120a;color:#f3e6cf;padding:32px;border-radius:12px;">
    <h2 style="color:#d9b46a;margin:0 0 16px;letter-spacing:1px;">THE KAYA LOUNGE</h2>
    ${bodyHtml}
  </div>`;
}

function sendVerificationEmail(to, code){
  return sendEmail(to, 'Verify your email — The Kaya Lounge', wrap(`
    <p>Welcome! Use this code to verify your email and activate your loyalty card:</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#d9b46a;">${code}</p>
    <p style="color:#b8a583;">This code expires in 15 minutes.</p>
  `));
}

function sendPasswordResetEmail(to, code){
  return sendEmail(to, 'Reset your password — The Kaya Lounge', wrap(`
    <p>Use this code to reset your password:</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#d9b46a;">${code}</p>
    <p style="color:#b8a583;">This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
  `));
}

function generateCode(){
  return String(Math.floor(100000 + Math.random() * 900000));
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, generateCode };
