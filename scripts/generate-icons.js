const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Cores do tema ServiceDesk
const colors = {
  primary: '#0ea5e9',
  secondary: '#0284c7',
  background: '#ffffff'
};

// Criar SVG do ícone base
const createIconSVG = (size, backgroundColor = colors.primary, textColor = '#ffffff') => {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${backgroundColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
      <g transform="translate(${size * 0.15}, ${size * 0.2})">
        <!-- Ticket icon -->
        <rect x="${size * 0.1}" y="${size * 0.1}" width="${size * 0.6}" height="${size * 0.15}" rx="${size * 0.03}" fill="${textColor}" opacity="0.9"/>
        <rect x="${size * 0.1}" y="${size * 0.3}" width="${size * 0.4}" height="${size * 0.08}" rx="${size * 0.02}" fill="${textColor}" opacity="0.7"/>
        <rect x="${size * 0.1}" y="${size * 0.45}" width="${size * 0.5}" height="${size * 0.08}" rx="${size * 0.02}" fill="${textColor}" opacity="0.7"/>
        <!-- Support symbol -->
        <circle cx="${size * 0.55}" cy="${size * 0.5}" r="${size * 0.08}" fill="${textColor}" opacity="0.6"/>
        <circle cx="${size * 0.55}" cy="${size * 0.5}" r="${size * 0.04}" fill="${backgroundColor}"/>
      </g>
    </svg>
  `;
};

// Gerar ícones em diferentes tamanhos
async function generateIcons() {
  const publicDir = path.join(__dirname, '..', 'public');

  // Garantir que o diretório existe
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const sizes = [
    { name: 'icon-16.png', size: 16 },
    { name: 'icon-32.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];

  for (const { name, size } of sizes) {
    const svg = createIconSVG(size);
    const outputPath = path.join(publicDir, name);

    try {
      await sharp(Buffer.from(svg))
        .png({ quality: 100, compressionLevel: 9 })
        .toFile(outputPath);

      console.log(`✅ Generated: ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Error generating ${name}:`, error.message);
    }
  }

  // Gerar Safari Pinned Tab SVG
  const safariSVG = `
    <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <path d="M2 2h12c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H2c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2z" fill="#000"/>
      <rect x="3" y="4" width="8" height="1.5" fill="#fff"/>
      <rect x="3" y="6.5" width="5" height="1" fill="#fff"/>
      <rect x="3" y="8.5" width="6" height="1" fill="#fff"/>
      <circle cx="10.5" cy="9" r="1" fill="#fff"/>
    </svg>
  `;

  fs.writeFileSync(path.join(publicDir, 'safari-pinned-tab.svg'), safariSVG);
  console.log('✅ Generated: safari-pinned-tab.svg');

  // Gerar browserconfig.xml para Windows
  const browserConfig = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
    <msapplication>
        <tile>
            <square150x150logo src="/icon-192.png"/>
            <TileColor>${colors.primary}</TileColor>
        </tile>
    </msapplication>
</browserconfig>`;

  fs.writeFileSync(path.join(publicDir, 'browserconfig.xml'), browserConfig);
  console.log('✅ Generated: browserconfig.xml');

  console.log('\n🎉 All icons generated successfully!');
}

generateIcons().catch(console.error);