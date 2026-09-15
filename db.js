const fs = require('fs');
const path = require('path');

// On Render, DATA_DIR should point at the mounted persistent disk (e.g. /data)
// so member/staff/reward data survives redeploys and restarts — without this,
// Render's free/ephemeral filesystem can wipe everything on the next deploy.
// Locally (no DATA_DIR set), this just falls back to living next to this file,
// same as before.
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_FILE = path.join(DATA_DIR, 'data.json');

function defaultData(){
  return {
    members: {},
    rewards: [
      { id: 1, stamps: 5, label: 'Half price on your next drink' },
      { id: 2, stamps: 10, label: 'A drink on us' }
    ],
    // Seed staff accounts — manage these from the admin dashboard from now on.
    staff: [
      { name: 'Ali', pin: '1111' },
      { name: 'Sara', pin: '2222' }
    ],
    activity: [],
    nextCardNum: 1,
    nextRewardId: 3,

    // Menu / ordering
    menuItems: [
      { id: 1, name: 'Double Apple Shisha', description: 'Classic double apple flavor', price: 1200, category: 'Shisha', available: true },
      { id: 2, name: 'Mint Shisha', description: 'Cool mint blend', price: 1200, category: 'Shisha', available: true },
      { id: 3, name: 'Grape Mint Shisha', description: 'Grape and mint mix', price: 1300, category: 'Shisha', available: true },
      { id: 4, name: 'Watermelon Shisha', description: 'Sweet watermelon blend', price: 1300, category: 'Shisha', available: true },
      { id: 5, name: 'Blueberry Shisha', description: 'Blueberry and mint mix', price: 1300, category: 'Shisha', available: true },
      { id: 6, name: 'Kashmiri Chai', description: 'Pink Kashmiri tea', price: 350, category: 'Drinks', available: true },
      { id: 7, name: 'Cold Coffee', description: 'Iced cold coffee', price: 450, category: 'Drinks', available: true },
      { id: 8, name: 'Mint Lemonade', description: 'Fresh mint and lemon', price: 300, category: 'Drinks', available: true },
      { id: 9, name: 'Mango Shake', description: 'Fresh mango milkshake', price: 450, category: 'Drinks', available: true },
      { id: 10, name: 'Green Tea', description: 'Fresh brewed green tea', price: 300, category: 'Drinks', available: true },
      { id: 11, name: 'Loaded Fries', description: 'Fries with cheese and sauces', price: 600, category: 'Food', available: true },
      { id: 12, name: 'Chicken Wings', description: 'Spicy grilled wings, 6 pcs', price: 800, category: 'Food', available: true },
      { id: 13, name: 'Club Sandwich', description: 'Triple layer chicken sandwich', price: 700, category: 'Food', available: true },
      { id: 14, name: 'Cheese Nachos', description: 'Nachos with cheese and jalapenos', price: 650, category: 'Food', available: true },
      { id: 15, name: 'Chicken Shawarma', description: 'Grilled chicken wrap with garlic sauce', price: 550, category: 'Food', available: true }
    ],
    nextMenuItemId: 16,
    promoCodes: [
      { code: 'KAYA10', discountPercent: 10, active: true }
    ],
    orders: [],
    nextOrderId: 1,
    serviceRequests: [],
    nextServiceId: 1
  };
}

function load(){
  if(!fs.existsSync(DB_FILE)){
    const data = defaultData();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return data;
  }
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const dd = defaultData();
  if(!data.staff) data.staff = dd.staff;
  if(!data.menuItems) data.menuItems = dd.menuItems;
  if(!data.nextMenuItemId) data.nextMenuItemId = dd.nextMenuItemId;
  if(!data.promoCodes) data.promoCodes = dd.promoCodes;
  if(!data.orders) data.orders = [];
  if(!data.nextOrderId) data.nextOrderId = 1;
  if(!data.serviceRequests) data.serviceRequests = [];
  if(!data.nextServiceId) data.nextServiceId = 1;
  return data;
}

let data = load();

function save(){
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  get data(){ return data; },
  save
};
