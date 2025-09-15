// Utility functions for generating meal names

export const generateMealName = (items: Array<{ qty: string; n: string }>, currentTime?: string): string => {
  if (!items || items.length === 0) return "Meal";
  
  // If only one item, use that as the base
  if (items.length === 1) {
    const item = items[0];
    return formatSingleItemName(item.n);
  }
  
  // For multiple items, try to find a pattern or create a descriptive name
  const itemNames = items.map(item => item.n.toLowerCase().trim());
  
  // Check for common meal patterns
  const patterns = {
    sandwich: ['bread', 'toast', 'bun', 'sandwich'],
    salad: ['lettuce', 'greens', 'salad', 'spinach', 'arugula'],
    pasta: ['pasta', 'spaghetti', 'noodles', 'macaroni', 'penne'],
    pizza: ['pizza', 'dough', 'cheese', 'pepperoni'],
    breakfast: ['egg', 'bacon', 'cereal', 'oats', 'yogurt', 'pancake'],
    smoothie: ['banana', 'berry', 'protein powder', 'milk', 'yogurt', 'smoothie'],
    soup: ['soup', 'broth', 'stock'],
    curry: ['curry', 'rice', 'chicken curry', 'beef curry'],
    stir_fry: ['stir fry', 'wok', 'soy sauce', 'vegetables'],
  };
  
  // Check for pattern matches
  for (const [pattern, keywords] of Object.entries(patterns)) {
    const hasKeyword = keywords.some(keyword => 
      itemNames.some(item => item.includes(keyword))
    );
    if (hasKeyword) {
      return formatPatternName(pattern, items);
    }
  }
  
  // If no pattern found, use the most substantial item
  const mainItem = findMainItem(items);
  if (mainItem) {
    const baseName = formatSingleItemName(mainItem.n);
    if (items.length > 2) {
      return `${baseName} & More`;
    } else {
      const otherItem = items.find(item => item !== mainItem);
      return `${baseName} & ${formatSingleItemName(otherItem?.n || '')}`;
    }
  }
  
  // Fallback to first item
  return formatSingleItemName(items[0].n);
};

const formatSingleItemName = (itemName: string): string => {
  if (!itemName) return "Meal";
  
  // Remove quantity words and clean up
  const cleaned = itemName
    .replace(/^\d+\s*(piece|pieces|slice|slices|cup|cups|tbsp|tsp|oz|gram|grams|g)\s+/i, '')
    .replace(/^(a|an|the)\s+/i, '')
    .trim();
  
  // Capitalize first letter of each word
  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const formatPatternName = (pattern: string, items: Array<{ qty: string; n: string }>): string => {
  const patternNames: Record<string, string> = {
    sandwich: 'Sandwich',
    salad: 'Salad',
    pasta: 'Pasta Dish',
    pizza: 'Pizza',
    breakfast: 'Breakfast',
    smoothie: 'Smoothie',
    soup: 'Soup',
    curry: 'Curry',
    stir_fry: 'Stir Fry',
  };
  
  const baseName = patternNames[pattern] || 'Meal';
  
  // Try to add a specific descriptor
  const mainIngredient = findMainProteinOrVegetable(items);
  if (mainIngredient && !mainIngredient.n.toLowerCase().includes(pattern)) {
    const descriptor = formatSingleItemName(mainIngredient.n);
    return `${descriptor} ${baseName}`;
  }
  
  return baseName;
};

const findMainItem = (items: Array<{ qty: string; n: string }>): { qty: string; n: string } | null => {
  // Prioritize proteins, then carbs, then others
  const proteinKeywords = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'egg', 'tofu', 'turkey'];
  const carbKeywords = ['rice', 'bread', 'pasta', 'potato', 'quinoa', 'oats'];
  
  for (const keywords of [proteinKeywords, carbKeywords]) {
    const mainItem = items.find(item => 
      keywords.some(keyword => item.n.toLowerCase().includes(keyword))
    );
    if (mainItem) return mainItem;
  }
  
  // Return the first item if no main item found
  return items[0] || null;
};

const findMainProteinOrVegetable = (items: Array<{ qty: string; n: string }>): { qty: string; n: string } | null => {
  const proteinKeywords = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'turkey', 'tofu', 'beans'];
  const vegetableKeywords = ['broccoli', 'spinach', 'carrots', 'tomato', 'onion', 'bell pepper', 'mushroom'];
  
  for (const keywords of [proteinKeywords, vegetableKeywords]) {
    const item = items.find(item => 
      keywords.some(keyword => item.n.toLowerCase().includes(keyword))
    );
    if (item) return item;
  }
  
  return null;
};

export const getTimeOfDay = (date: Date = new Date()): string => {
  const hour = date.getHours();
  
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'noon';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

export const getTimeRangeForPeriod = (period: string): { start: number; end: number } => {
  const ranges = {
    morning: { start: 7, end: 11 },
    noon: { start: 12, end: 13 },
    afternoon: { start: 14, end: 17 },
    evening: { start: 18, end: 20 },
    night: { start: 21, end: 23 },
  };
  
  return ranges[period as keyof typeof ranges] || { start: 12, end: 13 };
};