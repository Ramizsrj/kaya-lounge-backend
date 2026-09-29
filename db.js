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
      { id: 11, name: 'Loaded Fries', description: 'Fries with cheese and sauces', price: 600, category: 'Food', available: true },
      { id: 12, name: 'Chicken Wings', description: 'Spicy grilled wings, 6 pcs', price: 800, category: 'Food', available: true },
      { id: 13, name: 'Club Sandwich', description: 'Triple layer chicken sandwich', price: 700, category: 'Food', available: true },
      { id: 14, name: 'Cheese Nachos', description: 'Nachos with cheese and jalapenos', price: 650, category: 'Food', available: true },
      { id: 15, name: 'Chicken Shawarma', description: 'Grilled chicken wrap with garlic sauce', price: 550, category: 'Food', available: true },

      // Real Kaya Lounge coffee menu (from the printed 4-page coffee menu).
      // Items whose menu had no listed price (soft drinks, juices, V60) are
      // seeded at Rs 1 and available:false — set a real price in Admin →
      // Menu items and press "Show" to make them orderable.
      { id: 16, name: 'Strawberry Shortcake Matcha', description: 'Housemade strawberry shortcake syrup and strawberry jam mixed with oat milk and ceremonial matcha.', price: 1620, category: 'Coffee', subcategory: 'Matcha Drinks', available: true },
      { id: 17, name: 'Iced Daydream Matcha', description: 'Housemade vanilla bean, honey and cinnamon syrup mixed with oat milk and ceremonial matcha, served iced.', price: 1620, category: 'Coffee', subcategory: 'Matcha Drinks', available: true },
      { id: 18, name: 'Daydream Matcha', description: 'Housemade vanilla bean, honey and cinnamon syrup mixed with oat milk and ceremonial matcha.', price: 1620, category: 'Coffee', subcategory: 'Matcha Drinks', available: true },
      { id: 19, name: 'Iced Blueberry Matcha', description: 'A refreshing matcha latte, made with ceremonial grade matcha, with a twist of blueberry.', price: 1550, category: 'Coffee', subcategory: 'Matcha Drinks', available: true },
      { id: 20, name: 'Blueberry Matcha', description: 'A matcha latte made with ceremonial grade matcha, with a twist of blueberry.', price: 1550, category: 'Coffee', subcategory: 'Matcha Drinks', available: true },
      { id: 21, name: 'Iced Matcha Latte', description: 'Ceremonial grade matcha with milk over ice.', price: 1360, category: 'Coffee', subcategory: 'Matcha Drinks', available: true },
      { id: 22, name: 'Matcha Latte', description: 'Ceremonial grade matcha steamed with milk.', price: 1360, category: 'Coffee', subcategory: 'Matcha Drinks', available: true },

      { id: 23, name: 'Shaken Vanilla Bean Matcha', description: 'Housemade Madagascar vanilla bean shaken with oat milk and ceremonial matcha.', price: 1620, category: 'Coffee', subcategory: 'Signature Matchas', available: true },

      { id: 24, name: 'Pistachio Frappe', description: 'A refreshing pistachio frappe blended with smooth cream and ice, creating a rich, nutty treat.', price: 1850, category: 'Coffee', subcategory: 'Frappes', available: true },
      { id: 25, name: 'Caramel Frappe', description: 'Blended caramel coffee drink topped with cream.', price: 790, category: 'Coffee', subcategory: 'Frappes', available: true },
      { id: 26, name: 'Hazelnut Frappe', description: 'Smooth and creamy hazelnut frappe blended with ice and topped with whipped cream.', price: 790, category: 'Coffee', subcategory: 'Frappes', available: true },
      { id: 27, name: 'Vanilla Frappe', description: 'Smooth and creamy vanilla frappe blended with ice and topped with whipped cream.', price: 790, category: 'Coffee', subcategory: 'Frappes', available: true },

      { id: 28, name: 'Iced Pistachio Latte', description: 'Our classic latte, complemented by pistachio, served over ice.', price: 1550, category: 'Coffee', subcategory: 'Iced Drinks', available: true },
      { id: 29, name: 'Iced Hazelnut Latte', description: 'Smooth espresso blended with creamy milk and rich hazelnut flavoring, served over ice.', price: 750, category: 'Coffee', subcategory: 'Iced Drinks', available: true },
      { id: 30, name: 'Sea Salt Vanilla Latte', description: 'A delightful blend of creamy espresso and steamed milk infused with smooth vanilla and a touch of sea salt.', price: 975, category: 'Coffee', subcategory: 'Iced Drinks', available: true },
      { id: 31, name: 'Iced Spanish Latte', description: 'Refreshing iced Spanish latte blending smooth espresso with velvety steamed milk.', price: 750, category: 'Coffee', subcategory: 'Iced Drinks', available: true },
      { id: 32, name: 'Iced Caramel Latte', description: 'Smooth espresso blended with chilled milk and rich caramel syrup, served over ice.', price: 750, category: 'Coffee', subcategory: 'Iced Drinks', available: true },
      { id: 33, name: 'Iced French Vanilla Latte', description: 'Smooth espresso blended with creamy milk and rich French vanilla flavoring, served over ice.', price: 750, category: 'Coffee', subcategory: 'Iced Drinks', available: true },
      { id: 34, name: 'Iced Honey Latte', description: 'Chilled espresso beverage with milk and honey, featuring a refreshing and mildly sweet flavor.', price: 900, category: 'Coffee', subcategory: 'Iced Drinks', available: true },
      { id: 35, name: 'Iced Americano', description: 'Double espresso diluted with water over ice.', price: 1100, category: 'Coffee', subcategory: 'Iced Drinks', available: true },
      { id: 36, name: 'Iced Latte', description: 'Milk and a double espresso served over ice.', price: 1360, category: 'Coffee', subcategory: 'Iced Drinks', available: true },
      { id: 37, name: 'Iced Cappuccino', description: 'A refreshing iced cappuccino made with rich espresso shots topped with velvety foam.', price: 690, category: 'Coffee', subcategory: 'Iced Drinks', available: true },

      { id: 38, name: 'Blondie Latte', description: 'Our classic latte with salted brown sugar caramel, cookie butter, and miso, served hot.', price: 1620, category: 'Coffee', subcategory: 'Hot Drinks', available: true },
      { id: 39, name: 'Pistachio Latte', description: 'Our classic latte, complemented by pistachio.', price: 1550, category: 'Coffee', subcategory: 'Hot Drinks', available: true },
      { id: 40, name: 'Spanish Latte', description: 'Hot brewed espresso with milk featuring a rich, aromatic, and comforting flavor.', price: 730, category: 'Coffee', subcategory: 'Hot Drinks', available: true },
      { id: 41, name: 'Americano', description: 'Double espresso diluted with hot water.', price: 1100, category: 'Coffee', subcategory: 'Hot Drinks', available: true },
      { id: 42, name: 'Cappuccino', description: 'Milk over espresso with a thick layer of microfoam.', price: 1360, category: 'Coffee', subcategory: 'Hot Drinks', available: true },
      { id: 43, name: 'Cortado', description: 'Double espresso with steamed milk and a thin layer of microfoam.', price: 1210, category: 'Coffee', subcategory: 'Hot Drinks', available: true },
      { id: 44, name: 'Double Espresso', description: 'Classic double espresso extracted to perfection.', price: 990, category: 'Coffee', subcategory: 'Hot Drinks', available: true },
      { id: 45, name: 'Flat White', description: 'Double espresso with steamed milk and a thin layer of microfoam.', price: 1320, category: 'Coffee', subcategory: 'Hot Drinks', available: true },
      { id: 46, name: 'Latte', description: 'Milk over espresso with a layer of microfoam.', price: 1360, category: 'Coffee', subcategory: 'Hot Drinks', available: true },
      { id: 47, name: 'Macchiato (Hot or Iced)', description: 'Espresso marked with foam. Available hot or iced.', price: 1180, category: 'Coffee', subcategory: 'Hot Drinks', available: true },
      { id: 48, name: 'Piccolo', description: 'A small, intense coffee made with a single shot of espresso and a dollop of frothed milk.', price: 600, category: 'Coffee', subcategory: 'Hot Drinks', available: true },
      { id: 49, name: 'Espresso', description: 'A strong and intense shot of pure coffee.', price: 520, category: 'Coffee', subcategory: 'Hot Drinks', available: true },
      { id: 50, name: 'Long Black', description: 'A shot of espresso topped with a small amount of hot water.', price: 550, category: 'Coffee', subcategory: 'Hot Drinks', available: true },
      { id: 51, name: 'Callebaut Hot Chocolate', description: 'Indulge in premium Callebaut hot chocolate crafted from the finest Belgian chocolate. (Winter only)', price: 1050, category: 'Coffee', subcategory: 'Hot Drinks', available: true },

      { id: 52, name: 'Lavender Latte', description: 'Made with espresso, steamed milk, and the subtle flavor of lavender.', price: 790, category: 'Coffee', subcategory: 'Signature Lattes', available: true },
      { id: 53, name: 'Tiramisu Latte', description: 'Creamy espresso latte layered with tiramisu, velvety cheese cloud, and Dutch cocoa.', price: 970, category: 'Coffee', subcategory: 'Signature Lattes', available: true },
      { id: 54, name: 'Callebaut Mocha Latte', description: 'Hot espresso beverage with chocolate and milk offering a rich and comforting flavor. (Winter only)', price: 1200, category: 'Coffee', subcategory: 'Signature Lattes', available: true },
      { id: 55, name: 'Hot Nutty Raf', description: 'Extra creamy milk with espresso and rich macadamia notes. (Winter only)', price: 975, category: 'Coffee', subcategory: 'Signature Lattes', available: true },
      { id: 56, name: 'Iced Tiramisu Latte', description: 'Inspired by the Italian classic, this drink combines espresso, milk, and layers of tiramisu, topped with cocoa. (Large)', price: 1050, category: 'Coffee', subcategory: 'Signature Lattes', available: true },
      { id: 57, name: 'Iced Callebaut Mocha Latte', description: 'Chilled espresso beverage with chocolate and milk, featuring a rich and mildly sweet flavor.', price: 1200, category: 'Coffee', subcategory: 'Signature Lattes', available: true },

      { id: 58, name: 'Iced Cafe Mocha Latte', description: 'A refreshing blend of rich espresso, smooth steamed milk, and velvety chocolate.', price: 825, category: 'Coffee', subcategory: 'Chocolate', available: true },
      { id: 59, name: 'Iced Mocha', description: 'Cocoa powder mixed with milk and espresso over ice.', price: 1660, category: 'Coffee', subcategory: 'Chocolate', available: true },
      { id: 60, name: 'Mocha', description: 'Cocoa powder steamed with milk over espresso.', price: 1660, category: 'Coffee', subcategory: 'Chocolate', available: true },
      { id: 61, name: 'Hot Chocolate', description: 'Cocoa powder steamed with milk.', price: 1360, category: 'Coffee', subcategory: 'Chocolate', available: true },

      { id: 62, name: 'Original Cold Brew', description: 'Cold-brewed coffee with rich notes of milk chocolate & caramel.', price: 1250, category: 'Coffee', subcategory: 'Cold Brew', available: true },

      { id: 63, name: 'V60 Pour Over', description: 'Single-origin coffee hand-brewed through a V60 for a clean, bright cup. (Price not set yet)', price: 1, category: 'Coffee', subcategory: 'Brew Bar', available: false },

      { id: 64, name: 'Breakfast Tea', description: 'English Breakfast Tea.', price: 1070, category: 'Coffee', subcategory: 'Tea', available: true },
      { id: 65, name: 'Chamomile Tea', description: 'Floral and fragrant herbal chamomile tea.', price: 1070, category: 'Coffee', subcategory: 'Tea', available: true },
      { id: 66, name: 'Earl Grey Tea', description: 'Black tea with citrusy floral flavors and bergamot.', price: 1070, category: 'Coffee', subcategory: 'Tea', available: true },
      { id: 67, name: 'Jade Green Tea', description: 'Deliciously smooth and light green tea.', price: 1070, category: 'Coffee', subcategory: 'Tea', available: true },
      { id: 68, name: 'Matcha Tea', description: 'Ceremonial grade matcha whisked with water.', price: 1070, category: 'Coffee', subcategory: 'Tea', available: true },

      { id: 69, name: 'Iced Matcha Tea', description: 'Ceremonial grade matcha whisked with water over ice.', price: 1070, category: 'Coffee', subcategory: 'Iced Tea', available: true },
      { id: 70, name: 'Lemon Iced Tea', description: 'Slow brewed black tea with a touch of lemon over ice.', price: 1070, category: 'Coffee', subcategory: 'Iced Tea', available: true },
      { id: 71, name: 'Peach Iced Tea', description: 'Slow brewed black tea meets juicy peach, served over ice.', price: 1070, category: 'Coffee', subcategory: 'Iced Tea', available: true },

      { id: 72, name: 'San Pellegrino Sparkling Water', description: 'Natural sparkling mineral water.', price: 920, category: 'Coffee', subcategory: 'Grab & Go', available: true },
      { id: 73, name: 'Mineral Water', description: 'Chilled still mineral water. (Price not set yet)', price: 1, category: 'Coffee', subcategory: 'Grab & Go', available: false },
      { id: 74, name: 'Coca-Cola', description: 'Chilled classic cola. (Price not set yet)', price: 1, category: 'Coffee', subcategory: 'Grab & Go', available: false },
      { id: 75, name: 'Pepsi', description: 'Chilled classic cola. (Price not set yet)', price: 1, category: 'Coffee', subcategory: 'Grab & Go', available: false },
      { id: 76, name: 'Sprite', description: 'Chilled lemon-lime fizzy drink. (Price not set yet)', price: 1, category: 'Coffee', subcategory: 'Grab & Go', available: false },
      { id: 77, name: '7Up', description: 'Chilled lemon-lime fizzy drink. (Price not set yet)', price: 1, category: 'Coffee', subcategory: 'Grab & Go', available: false },
      { id: 78, name: 'Fanta', description: 'Chilled orange fizzy drink. (Price not set yet)', price: 1, category: 'Coffee', subcategory: 'Grab & Go', available: false },
      { id: 79, name: 'Red Bull', description: 'Chilled energy drink. (Price not set yet)', price: 1, category: 'Coffee', subcategory: 'Grab & Go', available: false },

      { id: 80, name: 'Almond Croissant', description: 'Traditional croissant with almond custard and almond shavings.', price: 1180, category: 'Coffee', subcategory: 'Baked Goods', available: true },
      { id: 81, name: 'Cinnamon Bun', description: 'Soft and fluffy, swirled with cinnamon and finished with a cream cheese frosting.', price: 1400, category: 'Coffee', subcategory: 'Baked Goods', available: true },
      { id: 82, name: 'Pain Au Chocolat', description: 'Traditional buttery and flaky chocolate croissant.', price: 1030, category: 'Coffee', subcategory: 'Baked Goods', available: true },
      { id: 83, name: 'Pistachio Creme Cookie', description: 'Pistachio cookie with toasted pistachios and a pistachio creme filling.', price: 1180, category: 'Coffee', subcategory: 'Baked Goods', available: true },
      { id: 84, name: 'Plain Croissant', description: 'Traditional buttery and flaky croissant.', price: 880, category: 'Coffee', subcategory: 'Baked Goods', available: true },
      { id: 85, name: 'Sea Salt Milk Chocolate Cookie', description: 'Chocolate chip cookie topped with flaky sea salt.', price: 1180, category: 'Coffee', subcategory: 'Baked Goods', available: true },
      { id: 86, name: 'Sicilian Lemon Cake', description: 'A buttery Sicilian-style lemon cake made with fragrant citrus.', price: 1180, category: 'Coffee', subcategory: 'Baked Goods', available: true },
      { id: 87, name: 'Vegan Chocolate Banana Bread', description: 'Vegan friendly slice filled with banana and delicious dark chocolate pieces.', price: 1180, category: 'Coffee', subcategory: 'Baked Goods', available: true },

      { id: 88, name: 'Fresh Orange Juice', description: 'Freshly squeezed orange juice. (Price not set yet)', price: 1, category: 'Coffee', subcategory: 'Fresh Juices', available: false },
      { id: 89, name: 'Fresh Apple Juice', description: 'Freshly pressed apple juice. (Price not set yet)', price: 1, category: 'Coffee', subcategory: 'Fresh Juices', available: false }
    ],
    nextMenuItemId: 90,
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
      { id: 2, time: '16:00', message: "The evening's calling, and honestly, so are we. Come unwind at Kaya Lounge — good food, smooth shisha, and the vibe you've been needing all day." }
    ],
    nextPopupId: 3,

    // Tracks which scheduled popups have already been pushed as a real
    // notification today, keyed by "YYYY-MM-DD_HH:MM", so a Render restart
    // or the keep-alive ping waking the server back up doesn't cause the
    // same reminder to be sent twice in one day.
    pushLog: {}
  };
}

// Fills in any fields a stored document predates (e.g. an old save from
// before the ordering system existed) without touching what's already there.
function withDefaults(stored){
  const dd = defaultData();
  const merged = Object.assign({}, dd, stored);
  if(!merged.menuItems || !merged.menuItems.length) merged.menuItems = dd.menuItems;
  // One-time migration: bring in the real Coffee menu (Sept 2026) on top of
  // whatever's already stored, without touching Food/Shisha or anything an
  // admin has since edited. Runs once — once a 'Coffee' item exists, it's a
  // no-op forever after, so this is safe to leave in place.
  if(!merged.menuItems.some(i => i.category === 'Coffee')){
    const oldPlaceholderDrinks = new Set(['Kashmiri Chai','Cold Coffee','Mint Lemonade','Mango Shake','Green Tea']);
    merged.menuItems = merged.menuItems
      .filter(i => !(i.category === 'Drinks' && oldPlaceholderDrinks.has(i.name)))
      .concat(dd.menuItems.filter(i => i.category === 'Coffee'));
    merged.nextMenuItemId = Math.max(merged.nextMenuItemId || 0, dd.nextMenuItemId);
  }
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
  if(!merged.pushLog) merged.pushLog = {};
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
