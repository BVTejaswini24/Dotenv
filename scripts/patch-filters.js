const fs = require('fs');
const file = './src/lib/utils/productFilters.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'function matchesCategory(product: Product, categories: string[]): boolean {\r\n  if (categories.length === 0) return true;\r\n  return categories.includes(product.category);\r\n}',
  'function matchesCategory(product: Product, categories: string[]): boolean {\r\n  if (categories.length === 0) return true;\r\n  return categories.some((c) => c.toLowerCase() === product.category.toLowerCase());\r\n}'
);

content = content.replace(
  'function matchesGender(product: Product, genders: string[]): boolean {\r\n  if (genders.length === 0) return true;\r\n  return genders.includes(product.gender || "unisex");\r\n}',
  'function matchesGender(product: Product, genders: string[]): boolean {\r\n  if (genders.length === 0) return true;\r\n  const productGender = (product.gender || "unisex").toLowerCase();\r\n  return genders.some((g) => g.toLowerCase() === productGender);\r\n}'
);

content = content.replace(
  'function matchesStyle(product: Product, styles: string[]): boolean {\r\n  if (styles.length === 0) return true;\r\n  return styles.includes((product.style || "").toLowerCase());\r\n}',
  'function matchesStyle(product: Product, styles: string[]): boolean {\r\n  if (styles.length === 0) return true;\r\n  const productStyle = (product.style || "").toLowerCase();\r\n  return styles.some((s) => s.toLowerCase() === productStyle);\r\n}'
);

fs.writeFileSync(file, content, 'utf8');
console.log('productFilters.ts patched successfully.');
