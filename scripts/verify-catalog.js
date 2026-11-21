const fs = require('fs');

// Count products in products.ts
const content = fs.readFileSync('src/lib/data/products.ts', 'utf8');

// Find all occurrences of "slug": "..."
const slugMatches = [...content.matchAll(/slug:\s*"([^"]+)"/g)].map(m => m[1]);
const quotedSlugMatches = [...content.matchAll(/"slug":\s*"([^"]+)"/g)].map(m => m[1]);
const allSlugs = [...slugMatches, ...quotedSlugMatches];

console.log('Total product slugs found:', allSlugs.length);
console.log('Unique product slugs:', new Set(allSlugs).size);

// Count occurrences of each category
const categories = ['t-shirts', 'shirts', 'jeans', 'pants', 'shorts', 'hoodies', 'jackets', 'accessories'];
categories.forEach(cat => {
  const re1 = new RegExp(`category:\\s*"${cat}"`, 'g');
  const re2 = new RegExp(`"category":\\s*"${cat}"`, 'g');
  const count1 = (content.match(re1) || []).length;
  const count2 = (content.match(re2) || []).length;
  console.log(`Category [${cat}]: ${count1 + count2} products`);
});
