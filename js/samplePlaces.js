export function getRandomPlaces() {
  const sample = [
    {
      name: 'Eiffel Tower',
      description: 'Paris, France',
      lat: 48.8584,
      lon: 2.2945,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Statue of Liberty',
      description: 'New York, USA',
      lat: 40.6892,
      lon: -74.0445,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Great Pyramid of Giza',
      description: 'Giza, Egypt',
      lat: 29.9792,
      lon: 31.1342,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Sydney Opera House',
      description: 'Sydney, Australia',
      lat: -33.8568,
      lon: 151.2153,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Taj Mahal',
      description: 'Agra, India',
      lat: 27.1751,
      lon: 78.0421,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Mount Fuji',
      description: 'Honshu, Japan',
      lat: 35.3606,
      lon: 138.7274,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Golden Gate Bridge',
      description: 'San Francisco, USA',
      lat: 37.8199,
      lon: -122.4783,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Christ the Redeemer',
      description: 'Rio de Janeiro, Brazil',
      lat: -22.9519,
      lon: -43.2105,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Colosseum',
      description: 'Rome, Italy',
      lat: 41.8902,
      lon: 12.4922,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Machu Picchu',
      description: 'Cusco Region, Peru',
      lat: -13.1631,
      lon: -72.545,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    }
  ];
  return sample.sort(() => Math.random() - 0.5);
}
