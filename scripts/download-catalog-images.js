const fs = require('fs');
const https = require('https');
const path = require('path');

const downloads = [
  // T-shirts (43..53)
  { cat: 't-shirts', file: 'product-43.jpg', url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-43-1.jpg', url: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-44.jpg', url: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-44-1.jpg', url: 'https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-45.jpg', url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-45-1.jpg', url: 'https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-46.jpg', url: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-46-1.jpg', url: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-47.jpg', url: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-47-1.jpg', url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-48.jpg', url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-48-1.jpg', url: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-49.jpg', url: 'https://images.unsplash.com/photo-1527719327859-c6ce80353573?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-49-1.jpg', url: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-50.jpg', url: 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-50-1.jpg', url: 'https://images.unsplash.com/photo-1503342452485-86b7f54527ef?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-51.jpg', url: 'https://images.unsplash.com/photo-1588117260148-b47818741c74?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-51-1.jpg', url: 'https://images.unsplash.com/photo-1618354691229-88d47f285158?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-52.jpg', url: 'https://images.unsplash.com/photo-1525450824786-227cbef70703?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-52-1.jpg', url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-53.jpg', url: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=700&auto=format&fit=crop&q=85' },
  { cat: 't-shirts', file: 'product-53-1.jpg', url: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=700&auto=format&fit=crop&q=85' },

  // Shirts (54..64)
  { cat: 'shirts', file: 'product-54.jpg', url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-54-1.jpg', url: 'https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-55.jpg', url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-55-1.jpg', url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-56.jpg', url: 'https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-56-1.jpg', url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-57.jpg', url: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-57-1.jpg', url: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-58.jpg', url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-58-1.jpg', url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-59.jpg', url: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-59-1.jpg', url: 'https://images.unsplash.com/photo-1621072156002-e2fccdc0b176?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-60.jpg', url: 'https://images.unsplash.com/photo-1554568218-0f1715e72254?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-60-1.jpg', url: 'https://images.unsplash.com/photo-1578932750294-f5075e85f44a?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-61.jpg', url: 'https://images.unsplash.com/photo-1621072156002-e2fccdc0b176?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-61-1.jpg', url: 'https://images.unsplash.com/photo-1626497764746-6dc36546b388?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-62.jpg', url: 'https://images.unsplash.com/photo-1626497764746-6dc36546b388?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-62-1.jpg', url: 'https://images.unsplash.com/photo-1604695573706-53170668f6a6?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-63.jpg', url: 'https://images.unsplash.com/photo-1604695573706-53170668f6a6?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-63-1.jpg', url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-64.jpg', url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shirts', file: 'product-64-1.jpg', url: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=700&auto=format&fit=crop&q=85' },

  // Jeans (65..78)
  { cat: 'jeans', file: 'product-65.jpg', url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-65-1.jpg', url: 'https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-66.jpg', url: 'https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-66-1.jpg', url: 'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-67.jpg', url: 'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-67-1.jpg', url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-68.jpg', url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-68-1.jpg', url: 'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-69.jpg', url: 'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-69-1.jpg', url: 'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-70.jpg', url: 'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-70-1.jpg', url: 'https://images.unsplash.com/photo-1604176354204-9268737828e4?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-71.jpg', url: 'https://images.unsplash.com/photo-1604176354204-9268737828e4?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-71-1.jpg', url: 'https://images.unsplash.com/photo-1555689502-c4b22d76c56f?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-72.jpg', url: 'https://images.unsplash.com/photo-1555689502-c4b22d76c56f?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-72-1.jpg', url: 'https://images.unsplash.com/photo-1560243563-062bfc001d68?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-73.jpg', url: 'https://images.unsplash.com/photo-1560243563-062bfc001d68?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-73-1.jpg', url: 'https://images.unsplash.com/photo-1582418702059-97ebafb35d09?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-74.jpg', url: 'https://images.unsplash.com/photo-1582418702059-97ebafb35d09?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-74-1.jpg', url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-75.jpg', url: 'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-75-1.jpg', url: 'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-76.jpg', url: 'https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-76-1.jpg', url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-77.jpg', url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-77-1.jpg', url: 'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-78.jpg', url: 'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jeans', file: 'product-78-1.jpg', url: 'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=700&auto=format&fit=crop&q=85' },

  // Pants (79..94)
  { cat: 'pants', file: 'product-79.jpg', url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-79-1.jpg', url: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-80.jpg', url: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-80-1.jpg', url: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-81.jpg', url: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-81-1.jpg', url: 'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-82.jpg', url: 'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-82-1.jpg', url: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-83.jpg', url: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-83-1.jpg', url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-84.jpg', url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-84-1.jpg', url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-85.jpg', url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-85-1.jpg', url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-86.jpg', url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-86-1.jpg', url: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-87.jpg', url: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-87-1.jpg', url: 'https://images.unsplash.com/photo-1548883354-7622d03aca27?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-88.jpg', url: 'https://images.unsplash.com/photo-1548883354-7622d03aca27?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-88-1.jpg', url: 'https://images.unsplash.com/photo-1551854838-212c50b4c184?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-89.jpg', url: 'https://images.unsplash.com/photo-1551854838-212c50b4c184?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-89-1.jpg', url: 'https://images.unsplash.com/photo-1508427953056-b00b8d78ebf5?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-90.jpg', url: 'https://images.unsplash.com/photo-1508427953056-b00b8d78ebf5?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-90-1.jpg', url: 'https://images.unsplash.com/photo-1519748771451-a94c596fad67?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-91.jpg', url: 'https://images.unsplash.com/photo-1519748771451-a94c596fad67?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-91-1.jpg', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-92.jpg', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-92-1.jpg', url: 'https://images.unsplash.com/photo-1588117260148-b47818741c74?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-93.jpg', url: 'https://images.unsplash.com/photo-1588117260148-b47818741c74?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-93-1.jpg', url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-94.jpg', url: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=700&auto=format&fit=crop&q=85' },
  { cat: 'pants', file: 'product-94-1.jpg', url: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?w=700&auto=format&fit=crop&q=85' },

  // Shorts (95..109)
  { cat: 'shorts', file: 'product-95.jpg', url: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-95-1.jpg', url: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-96.jpg', url: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-96-1.jpg', url: 'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-97.jpg', url: 'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-97-1.jpg', url: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-98.jpg', url: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-98-1.jpg', url: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-99.jpg', url: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-99-1.jpg', url: 'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-100.jpg', url: 'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-100-1.jpg', url: 'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-101.jpg', url: 'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-101-1.jpg', url: 'https://images.unsplash.com/photo-1604176354204-9268737828e4?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-102.jpg', url: 'https://images.unsplash.com/photo-1604176354204-9268737828e4?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-102-1.jpg', url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-103.jpg', url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-103-1.jpg', url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-104.jpg', url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-104-1.jpg', url: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-105.jpg', url: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-105-1.jpg', url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-106.jpg', url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-106-1.jpg', url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-107.jpg', url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-107-1.jpg', url: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-108.jpg', url: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-108-1.jpg', url: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-109.jpg', url: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=700&auto=format&fit=crop&q=85' },
  { cat: 'shorts', file: 'product-109-1.jpg', url: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=700&auto=format&fit=crop&q=85' },

  // Hoodies (110..124)
  { cat: 'hoodies', file: 'product-110.jpg', url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-110-1.jpg', url: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-111.jpg', url: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-111-1.jpg', url: 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-112.jpg', url: 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-112-1.jpg', url: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-113.jpg', url: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-113-1.jpg', url: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-114.jpg', url: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-114-1.jpg', url: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-115.jpg', url: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-115-1.jpg', url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-116.jpg', url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-116-1.jpg', url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-117.jpg', url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-117-1.jpg', url: 'https://images.unsplash.com/photo-1588117260148-b47818741c74?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-118.jpg', url: 'https://images.unsplash.com/photo-1588117260148-b47818741c74?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-118-1.jpg', url: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-119.jpg', url: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-119-1.jpg', url: 'https://images.unsplash.com/photo-1527719327859-c6ce80353573?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-120.jpg', url: 'https://images.unsplash.com/photo-1527719327859-c6ce80353573?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-120-1.jpg', url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-121.jpg', url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-121-1.jpg', url: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-122.jpg', url: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-122-1.jpg', url: 'https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-123.jpg', url: 'https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-123-1.jpg', url: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-124.jpg', url: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=700&auto=format&fit=crop&q=85' },
  { cat: 'hoodies', file: 'product-124-1.jpg', url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=700&auto=format&fit=crop&q=85' },

  // Jackets (125..139)
  { cat: 'jackets', file: 'product-125.jpg', url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-125-1.jpg', url: 'https://images.unsplash.com/photo-1548883354-7622d03aca27?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-126.jpg', url: 'https://images.unsplash.com/photo-1548883354-7622d03aca27?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-126-1.jpg', url: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-127.jpg', url: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-127-1.jpg', url: 'https://images.unsplash.com/photo-1559551409-dadc959f76b8?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-128.jpg', url: 'https://images.unsplash.com/photo-1559551409-dadc959f76b8?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-128-1.jpg', url: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-129.jpg', url: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-129-1.jpg', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-130.jpg', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-130-1.jpg', url: 'https://images.unsplash.com/photo-1495105787522-5334e3ffa0ef?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-131.jpg', url: 'https://images.unsplash.com/photo-1495105787522-5334e3ffa0ef?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-131-1.jpg', url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-132.jpg', url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-132-1.jpg', url: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-133.jpg', url: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-133-1.jpg', url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-134.jpg', url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-134-1.jpg', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-135.jpg', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-135-1.jpg', url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-136.jpg', url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-136-1.jpg', url: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-137.jpg', url: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-137-1.jpg', url: 'https://images.unsplash.com/photo-1508427953056-b00b8d78ebf5?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-138.jpg', url: 'https://images.unsplash.com/photo-1508427953056-b00b8d78ebf5?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-138-1.jpg', url: 'https://images.unsplash.com/photo-1519748771451-a94c596fad67?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-139.jpg', url: 'https://images.unsplash.com/photo-1519748771451-a94c596fad67?w=700&auto=format&fit=crop&q=85' },
  { cat: 'jackets', file: 'product-139-1.jpg', url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=700&auto=format&fit=crop&q=85' },

  // Accessories (140..144)
  { cat: 'accessories', file: 'product-140.jpg', url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=700&auto=format&fit=crop&q=85' },
  { cat: 'accessories', file: 'product-140-1.jpg', url: 'https://images.unsplash.com/photo-1600003014755-ba31aa59c4b6?w=700&auto=format&fit=crop&q=85' },
  { cat: 'accessories', file: 'product-141.jpg', url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=700&auto=format&fit=crop&q=85' },
  { cat: 'accessories', file: 'product-141-1.jpg', url: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=700&auto=format&fit=crop&q=85' },
  { cat: 'accessories', file: 'product-142.jpg', url: 'https://images.unsplash.com/photo-1508296695146-257a814070b4?w=700&auto=format&fit=crop&q=85' },
  { cat: 'accessories', file: 'product-142-1.jpg', url: 'https://images.unsplash.com/photo-1576053139778-7e32f2ae3cfd?w=700&auto=format&fit=crop&q=85' },
  { cat: 'accessories', file: 'product-143.jpg', url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=700&auto=format&fit=crop&q=85' },
  { cat: 'accessories', file: 'product-143-1.jpg', url: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?w=700&auto=format&fit=crop&q=85' },
  { cat: 'accessories', file: 'product-144.jpg', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700&auto=format&fit=crop&q=85' },
  { cat: 'accessories', file: 'product-144-1.jpg', url: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=700&auto=format&fit=crop&q=85' },
];

console.log('Total files to download:', downloads.length);

async function downloadFile(item) {
  const destDir = path.join(__dirname, '../public/images/products', item.cat);
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, item.file);

  return new Promise((resolve) => {
    https.get(item.url, (res) => {
      if (res.statusCode !== 200) {
        console.error(`Failed ${item.file}: Status ${res.statusCode}`);
        return resolve({ success: false, file: item.file });
      }
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        const size = fs.statSync(destPath).size;
        resolve({ success: true, file: item.file, size });
      });
    }).on('error', (err) => {
      console.error(`Error ${item.file}: ${err.message}`);
      resolve({ success: false, file: item.file });
    });
  });
}

async function run() {
  console.log('Starting parallel batch downloads...');
  let completed = 0;
  let totalBytes = 0;
  const batchSize = 10;

  for (let i = 0; i < downloads.length; i += batchSize) {
    const chunk = downloads.slice(i, i + batchSize);
    const results = await Promise.all(chunk.map(downloadFile));
    results.forEach(r => {
      if (r.success) {
        completed++;
        totalBytes += r.size;
      }
    });
    console.log(`Progress: ${completed} / ${downloads.length} downloaded (${Math.round(totalBytes / 1024)} KB)`);
  }

  console.log(`Finished! Successfully downloaded ${completed} of ${downloads.length} images (${Math.round(totalBytes / (1024 * 1024) * 100) / 100} MB)`);
}

run();
