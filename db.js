const { MongoClient } = require('mongodb');

// Set MONGODB_URI (on Render: Environment tab) to a free MongoDB Atlas
// connection string to make all data (members, staff, orders, etc.) survive
// redeploys and restarts. Without it, data only lives in memory for as long
// as this process runs — fine for local testing, NOT fine for production.
const MONGODB_URI = process.env.MONGODB_URI || '';
const DOC_ID = 'kaya-lounge';

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
    nextServiceId: 1,
    announcement: null,

    // Scheduled popup reminders — shown to a customer once, the first time
    // they have the app open during that time-of-day. Several messages can
    // share the same time; one is picked at random so it feels fresh from
    // day to day instead of repeating the exact same line every time.
    popupNotifications: [
      { id: 1, time: '12:00', message: "Psst — it's 12pm and you're already one of our favourite people today. No big deal, just facts. 😎" },
      { id: 2, time: '12:00', message: "Reminder: without you, our shisha coals would just sit there looking sad. Thanks for being awesome. ☁️" },
      { id: 3, time: '12:00', message: "Breaking news at noon: The Kaya Lounge regulars are officially the coolest people in town. That's you. Yes, you." },
      { id: 4, time: '12:00', message: "It's midday and we just wanted to say — you make Kaya Lounge, Kaya Lounge. Come prove it again today?" },
      { id: 5, time: '12:00', message: "Lunch break PSA: you deserve a 'treat yourself' energy today. Kaya Lounge is open and ready." },
      { id: 6, time: '16:00', message: "The evening's calling, and honestly, so are we. Come unwind at Kaya Lounge — good food, smooth shisha, and the vibe you've been needing all day." },
      { id: 7, time: '16:00', message: "4 o'clock thought: your day's been a lot. Let Kaya Lounge handle the rest — relax, eat, smoke, chill, repeat." },
      { id: 8, time: '16:00', message: "Golden hour, golden vibes. Swing by Kaya Lounge for a bite, a puff, and some well-earned chill time." },
      { id: 9, time: '16:00', message: "Long day? Kaya Lounge has your seat warm, your flavour ready, and zero judgement about how long you stay." },
      { id: 10, time: '16:00', message: "This is your 4pm sign to log off early and come vibe with us — food, shisha, good company. Kaya Lounge is waiting." }
    ],
    nextPopupId: 11
  };
}

// Fills in any fields a stored document predates (e.g. an old save from
// before the ordering system existed) without touching what's already there.
function withDefaults(stored){
  const dd = defaultData();
  const merged = Object.assign({}, dd, stored);
  if(!merged.menuItems || !merged.menuItems.length) merged.menuItems = dd.menuItems;
  if(!merged.promoCodes) merged.promoCodes = dd.promoCodes;
  if(!merged.orders) merged.orders = [];
  if(!merged.nextOrderId) merged.nextOrderId = 1;
  if(!merged.serviceRequests) merged.serviceRequests = [];
  if(!merged.nextServiceId) merged.nextServiceId = 1;
  if(!merged.nextMenuItemId) merged.nextMenuItemId = dd.nextMenuItemId;
  if(!merged.staff || !merged.staff.length) merged.staff = dd.staff;
  if(merged.announcement===undefined) merged.announcement = null;
  if(!merged.popupNotifications) merged.popupNotifications = dd.popupNotifications;
  if(!merged.nextPopupId) merged.nextPopupId = dd.nextPopupId;
  return merged;
}

let data = defaultData();
let collection = null;

const ready = (async () => {
  if(!MONGODB_URI){
    console.log('No MONGODB_URI set — running with in-memory data only. This will NOT survive a restart. Set MONGODB_URI (see backend README) to persist data.');
    return;
  }
  try{
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    collection = client.db('kayalounge').collection('state');
    const existing = await collection.findOne({ _id: DOC_ID });
    if(existing){
      delete existing._id;
      data = withDefaults(existing);
    }else{
      await collection.insertOne(Object.assign({ _id: DOC_ID }, data));
    }
    console.log('Connected to MongoDB Atlas — data will persist across restarts.');
  }catch(err){
    console.error('Could not connect to MongoDB, falling back to in-memory data (will NOT persist):', err.message);
    collection = null;
  }
})();

function save(){
  if(!collection) return;
  collection.replaceOne({ _id: DOC_ID }, Object.assign({ _id: DOC_ID }, data)).catch(err => {
    console.error('Failed to save to MongoDB:', err.message);
  });
}

module.exports = {
  get data(){ return data; },
  save,
  ready: () => ready
};
