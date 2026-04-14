const fs = require('fs');
const path = require('path');

const ROOT_ENV = path.join(__dirname, '..', '.env');
const DESTINATIONS = [
  path.join(__dirname, '..', 'frontend', '.env'),
  path.join(__dirname, '..', 'mobile', '.env'),
];

function sync() {
  if (!fs.existsSync(ROOT_ENV)) {
    console.error('❌ Root .env file not found!');
    process.exit(1);
  }

  const content = fs.readFileSync(ROOT_ENV, 'utf8');

  DESTINATIONS.forEach(dest => {
    const dir = path.dirname(dest);
    if (fs.existsSync(dir)) {
      fs.writeFileSync(dest, content);
      console.log(`✅ Synced .env to ${path.relative(path.join(__dirname, '..'), dest)}`);
    } else {
      console.warn(`⚠️ skipping ${path.relative(path.join(__dirname, '..'), dest)} (directory not found)`);
    }
  });

  console.log('🚀 Environment variables synchronization complete!');
}

sync();
