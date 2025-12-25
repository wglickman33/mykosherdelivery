export const AVAILABLE_LABELS = {
  D: 'Dairy',
  M: 'Meat', 
  V: 'Vegetarian',
  Ve: 'Vegan',
  GF: 'Gluten Free',
  Gfa: 'Gluten Free Available'
};

export const LABEL_OPTIONS = Object.entries(AVAILABLE_LABELS).map(([code, description]) => ({
  code,
  description
}));
