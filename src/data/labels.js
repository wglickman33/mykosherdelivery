// Available menu item labels with their full descriptions
export const AVAILABLE_LABELS = {
  D: 'Dairy',
  M: 'Meat', 
  V: 'Vegetarian',
  Ve: 'Vegan',
  GF: 'Gluten Free',
  Gfa: 'Gluten Free Available'
};

// Convert to array format for easier iteration
export const LABEL_OPTIONS = Object.entries(AVAILABLE_LABELS).map(([code, description]) => ({
  code,
  description
}));
