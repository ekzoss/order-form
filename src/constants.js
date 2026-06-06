export const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const generateSolidColorBackground = (color, width = 800, height = 1000) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.9);
};

export const DEFAULT_TSHIRT_BACKGROUNDS = [
  {
    id: 'white',
    name: 'White',
    color: '#FFFFFF',
    url: generateSolidColorBackground('#FFFFFF')
  },
  {
    id: 'black',
    name: 'Black',
    color: '#000000',
    url: generateSolidColorBackground('#000000')
  },
  {
    id: 'gray',
    name: 'Gray',
    color: '#808080',
    url: generateSolidColorBackground('#808080')
  },
  {
    id: 'navy',
    name: 'Navy',
    color: '#001F3F',
    url: generateSolidColorBackground('#001F3F')
  },
  {
    id: 'red',
    name: 'Red',
    color: '#DC143C',
    url: generateSolidColorBackground('#DC143C')
  },
  {
    id: 'maroon',
    name: 'Maroon',
    color: '#800000',
    url: generateSolidColorBackground('#800000')
  },
  {
    id: 'green',
    name: 'Forest Green',
    color: '#228B22',
    url: generateSolidColorBackground('#228B22')
  },
  {
    id: 'royal',
    name: 'Royal Blue',
    color: '#4169E1',
    url: generateSolidColorBackground('#4169E1')
  },
  {
    id: 'purple',
    name: 'Purple',
    color: '#800080',
    url: generateSolidColorBackground('#800080')
  },
  {
    id: 'orange',
    name: 'Orange',
    color: '#FF8C00',
    url: generateSolidColorBackground('#FF8C00')
  },
  {
    id: 'brown',
    name: 'Brown',
    color: '#8B4513',
    url: generateSolidColorBackground('#8B4513')
  },
  {
    id: 'pink',
    name: 'Pink',
    color: '#FF69B4',
    url: generateSolidColorBackground('#FF69B4')
  },
  {
    id: 'yellow',
    name: 'Gold',
    color: '#FFD700',
    url: generateSolidColorBackground('#FFD700')
  },
  {
    id: 'lightblue',
    name: 'Light Blue',
    color: '#87CEEB',
    url: generateSolidColorBackground('#87CEEB')
  }
];

// Made with Bob
