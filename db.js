const fs = require('fs');
const path = require('path');

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
    nextRewardId: 3
  };
}

function load(){
  if(!fs.existsSync(DB_FILE)){
    const data = defaultData();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return data;
  }
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if(!data.staff) data.staff = defaultData().staff;
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
