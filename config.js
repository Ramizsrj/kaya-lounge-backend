module.exports = {
  PORT: process.env.PORT || 3000,

  // Change this before putting the app anywhere real — anyone who knows this
  // value can forge login tokens. Set it via the JWT_SECRET environment
  // variable in production instead of editing this file.
  JWT_SECRET: process.env.JWT_SECRET || 'kaya-lounge-demo-secret-change-me',

  // Staff accounts are managed from the admin dashboard now (stored in
  // backend/data.json, seeded with Ali/1111 and Sara/2222 the first time
  // the server runs) — nothing to edit here for staff anymore.

  ADMIN_PIN: process.env.ADMIN_PIN || '9999'
};
