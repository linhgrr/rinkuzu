const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Simple SVG icon for RinKuzu
const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="512" height="512" rx="64" fill="url(#grad)"/>
  
  <!-- Quiz document icon -->
  <rect x="128" y="96" width="256" height="320" rx="16" fill="white" opacity="0.95"/>
  
  <!-- Lines representing quiz questions -->
  <rect x="160" y="144" width="192" height="8" rx="4" fill="#667eea" opacity="0.8"/>
  <rect x="160" y="176" width="160" height="8" rx="4" fill="#667eea" opacity="0.6"/>
  <rect x="160" y="208" width="128" height="8" rx="4" fill="#667eea" opacity="0.6"/>
  
  <!-- Quiz bubbles -->
  <circle cx="168" cy="256" r="8" fill="#667eea" opacity="0.7"/>
  <circle cx="200" cy="256" r="8" fill="#667eea" opacity="0.5"/>
  <circle cx="232" cy="256" r="8" fill="#667eea" opacity="0.5"/>
  
  <circle cx="168" cy="288" r="8" fill="#667eea" opacity="0.5"/>
  <circle cx="200" cy="288" r="8" fill="#667eea" opacity="0.7"/>
  <circle cx="232" cy="288" r="8" fill="#667eea" opacity="0.5"/>
  
  <!-- Check mark -->
  <path d="M320 240 L340 260 L380 220" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
`;

async function generateIcons() {
  const iconsDir = path.join(__dirname, '..', 'public', 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Save the SVG file
  fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgIcon);

  // Icon sizes needed for PWA
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  
  // Convert SVG to buffer
  const svgBuffer = Buffer.from(svgIcon);

  for (const size of sizes) {
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
      
      console.log(`Generated icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`Error generating ${size}x${size} icon:`, error);
    }
  }

  // Generate favicon
  try {
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(path.join(__dirname, '..', 'public', 'favicon.png'));
    
    console.log('Generated favicon.png');
  } catch (error) {
    console.error('Error generating favicon:', error);
  }

  // Generate apple-touch-icon
  try {
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(path.join(__dirname, '..', 'public', 'apple-touch-icon.png'));
    
    console.log('Generated apple-touch-icon.png');
  } catch (error) {
    console.error('Error generating apple-touch-icon:', error);
  }

  console.log('All PWA icons generated successfully!');
}

generateIcons().catch(console.error); 