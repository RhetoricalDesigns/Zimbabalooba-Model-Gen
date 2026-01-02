
import { Product } from "../types";

/**
 * Robustly extracts a Wix Image ID from a string, supporting raw filenames, 
 * full URLs, and internal Wix URIs.
 */
const getWixImageId = (url: string): string | null => {
  if (!url) return null;
  const clean = url.trim();
  
  // Case 1: Internal Wix URI wix:image://v1/hash~mv2.jpg/...
  if (clean.startsWith('wix:image')) {
    const parts = clean.split('/');
    const idPart = parts.find(p => p.includes('~mv2'));
    if (idPart) return idPart.split('#')[0];
  }

  // Case 2: Any string containing ~mv2 is a Wix media asset
  if (clean.includes('~mv2')) {
    const parts = clean.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.split('?')[0].split('#')[0];
  }

  // Case 3: Standard Wix hash patterns (usually hex_something.jpg)
  const hashMatch = clean.match(/[a-f0-9]{6,}_[a-f0-9]{6,}\.(jpg|png|webp|jpeg)/i);
  if (hashMatch) return hashMatch[0];

  return null;
};

/**
 * Ensures URLs have proper protocols.
 */
const sanitizeUrl = (url: string): string => {
  let clean = url.trim();
  if (clean.startsWith('//')) return `https:${clean}`;
  return clean;
};

/**
 * Transforms CSV image fields into standard objects.
 * Prioritizes raw URLs to ensure "pulled from CSV" reliability.
 */
const transformImageUrl = (input: string): { full: string; thumb: string } => {
  if (!input) return { full: "", thumb: "" };
  let val = input.trim();

  // 1. Handle JSON (Some Wix/Shopify exports stringify the image array)
  if (val.startsWith('[') || val.startsWith('{')) {
    try {
      const parsed = JSON.parse(val);
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      val = first.url || first.src || first.image || first.id || val;
    } catch (e) {}
  }

  // 2. Handle multiple items (Pick the first)
  val = val.split(/[;|,]/)[0].trim();

  // 3. Handle Full URLs
  if (val.startsWith('http') || val.startsWith('//')) {
    const sanitized = sanitizeUrl(val);
    const wixId = getWixImageId(sanitized);
    // If it's a Wix URL, we can still generate a dynamic thumbnail
    if (wixId) {
      return {
        full: sanitized,
        thumb: `https://static.wixstatic.com/media/${wixId}/v1/fill/w_400,h_400,al_c,q_80/thumbnail.jpg`
      };
    }
    return { full: sanitized, thumb: sanitized };
  }

  // 4. Handle Raw Wix Filenames (e.g. 8bb231_...~mv2.jpg)
  const wixId = getWixImageId(val);
  if (wixId) {
    return {
      full: `https://static.wixstatic.com/media/${wixId}`,
      thumb: `https://static.wixstatic.com/media/${wixId}/v1/fill/w_400,h_400,al_c,q_80/thumbnail.jpg`
    };
  }

  // 5. Fallback: return as is
  return { full: val, thumb: val };
};

/**
 * Enhanced heuristic to extract sizes (Letter or Numeric Waist) from product titles.
 */
const extractSizeFromTitle = (title: string): string => {
  if (!title) return "";
  
  // Check for waist sizes (e.g., 32, 32W, 34x32)
  const waistMatch = title.match(/\b(2[4-9]|3[0-9]|4[0-8])([wW])?\b/);
  if (waistMatch) return waistMatch[0].toUpperCase();

  // Check for dimension patterns (e.g., 32/34)
  const slashMatch = title.match(/\b(2[4-9]|3[0-9]|4[0-8])\/(2[4-9]|3[0-9]|4[0-8])\b/);
  if (slashMatch) return slashMatch[0];

  // Check for letter sizes (XS - XXXL)
  const letterMatch = title.match(/\b(XS|S|M|L|XL|XXL|XXXL|2XL|3XL)\b/i);
  if (letterMatch) return letterMatch[0].toUpperCase();

  return "";
};

export const parseProductCSV = (text: string): Product[] => {
  const rows = parseCSVRows(text);
  if (rows.length < 2) return [];

  const rawHeaders = rows[0];
  const normalizedHeaders = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const data = rows.slice(1);

  const findColIdx = (possible: string[]) => {
    const targets = possible.map(p => p.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return targets.map(t => normalizedHeaders.indexOf(t)).find(i => i !== -1);
  };

  return data.map((row, index) => {
    const getVal = (possibleHeaders: string[]) => {
      const idx = findColIdx(possibleHeaders);
      return (idx !== undefined && row[idx]) ? row[idx].trim() : "";
    };

    const name = getVal(['name', 'title', 'productname', 'producttitle', 'handle', 'itemname']);
    
    // Broad fuzzy matching for image columns
    const imageCol = [
      'productimageurl', 'productimage', 'image', 'images', 'thumbnail', 
      'mainimage', 'picture', 'url', 'src', 'img', 'media', 'photo', 'gallery'
    ];
    const rawImage = getVal(imageCol);
    const imageInfo = transformImageUrl(rawImage);
    
    const handleId = getVal(['handleid', 'id', 'productid', 'handle', 'sku']) || `item-${index}`;
    const description = getVal(['description', 'plaindescription', 'productdescription', 'content', 'body', 'excerpt', 'shortdescription']);
    const price = getVal(['price', 'value', 'pricevalue', 'amount', 'regularprice', 'saleprice', 'cost']);
    const sku = getVal(['sku', 'code', 'reference', 'partnumber']);
    const collection = getVal(['collection', 'category', 'type', 'categories', 'tag']);
    
    // Size logic: Check column first, then title
    let size = getVal(['size', 'option1', 'variantinventorysize', 'variantsize', 'optionsize']);
    if (!size) size = extractSizeFromTitle(name);
    
    const rawDate = getVal(['date', 'created', 'createdat', 'dateuploaded']);
    const dateUploaded = rawDate ? new Date(rawDate).getTime() : Date.now() - (index * 1000); 

    return {
      handleId,
      name,
      description,
      imageUrl: imageInfo.full,
      thumbnailUrl: imageInfo.thumb,
      price,
      sku,
      collection,
      size,
      dateUploaded
    };
  }).filter(p => p.name && p.imageUrl);
};

function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (inQuotes) {
      if (char === '"' && nextChar === '"') { currentField += '"'; i++; }
      else if (char === '"') inQuotes = false;
      else currentField += char;
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ',') { currentRow.push(currentField); currentField = ''; }
      else if (char === '\r' || char === '\n') {
        currentRow.push(currentField);
        if (currentRow.some(field => field.trim().length > 0)) rows.push(currentRow);
        currentRow = []; currentField = '';
        if (char === '\r' && nextChar === '\n') i++;
      } else currentField += char;
    }
  }
  if (currentRow.length > 0 || currentField !== '') {
    currentRow.push(currentField);
    if (currentRow.some(field => field.trim().length > 0)) rows.push(currentRow);
  }
  return rows;
}
