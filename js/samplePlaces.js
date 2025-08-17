export function getRandomPlaces() {
  const sample = [
    {
      name: 'Eiffel Tower',
      description: 'Paris, France',
      lat: 48.8584,
      lon: 2.2945,
      tags: ['landmark', 'historic', 'architecture'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Statue of Liberty',
      description: 'New York, USA',
      lat: 40.6892,
      lon: -74.0445,
      tags: ['landmark', 'monument', 'historic'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Great Pyramid of Giza',
      description: 'Giza, Egypt',
      lat: 29.9792,
      lon: 31.1342,
      tags: ['landmark', 'ancient', 'world wonder'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Sydney Opera House',
      description: 'Sydney, Australia',
      lat: -33.8568,
      lon: 151.2153,
      tags: ['landmark', 'performing arts', 'architecture'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Taj Mahal',
      description: 'Agra, India',
      lat: 27.1751,
      lon: 78.0421,
      tags: ['landmark', 'heritage', 'mausoleum'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Mount Fuji',
      description: 'Honshu, Japan',
      lat: 35.3606,
      lon: 138.7274,
      tags: ['landmark', 'natural', 'mountain'],
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
    },
    {
      name: 'El Tarter',
      description: 'Andorra',
      lat: 42.57952,
      lon: 1.65362,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Sant Julià de Lòria',
      description: 'Andorra',
      lat: 42.46372,
      lon: 1.49129,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Pas de la Casa',
      description: 'Andorra',
      lat: 42.54277,
      lon: 1.73361,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Ordino',
      description: 'Andorra',
      lat: 42.55623,
      lon: 1.53319,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'les Escaldes',
      description: 'Andorra',
      lat: 42.50729,
      lon: 1.53414,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'la Massana',
      description: 'Andorra',
      lat: 42.54499,
      lon: 1.51483,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Encamp',
      description: 'Andorra',
      lat: 42.53474,
      lon: 1.58014,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Canillo',
      description: 'Andorra',
      lat: 42.5676,
      lon: 1.59756,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Arinsal',
      description: 'Andorra',
      lat: 42.57205,
      lon: 1.48453,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Anyós',
      description: 'Andorra',
      lat: 42.53465,
      lon: 1.5251,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Andorra la Vella',
      description: 'Andorra',
      lat: 42.50779,
      lon: 1.52109,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Aixirivall',
      description: 'Andorra',
      lat: 42.46245,
      lon: 1.50209,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Warīsān',
      description: 'United Arab Emirates',
      lat: 25.16744,
      lon: 55.40708,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Umm Suqaym',
      description: 'United Arab Emirates',
      lat: 25.15491,
      lon: 55.21015,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Umm Al Quwain City',
      description: 'United Arab Emirates',
      lat: 25.56473,
      lon: 55.55517,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Ţarīf Kalbā',
      description: 'United Arab Emirates',
      lat: 25.0695,
      lon: 56.33115,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Ar Rāshidīyah',
      description: 'United Arab Emirates',
      lat: 25.22499,
      lon: 55.38947,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Ras Al Khaimah City',
      description: 'United Arab Emirates',
      lat: 25.78953,
      lon: 55.9432,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Muzayri‘',
      description: 'United Arab Emirates',
      lat: 23.14355,
      lon: 53.7881,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Murbaḩ',
      description: 'United Arab Emirates',
      lat: 25.27623,
      lon: 56.36256,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Maşfūţ',
      description: 'United Arab Emirates',
      lat: 24.81089,
      lon: 56.10657,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Zayed City',
      description: 'United Arab Emirates',
      lat: 23.65416,
      lon: 53.70522,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Khawr Fakkān',
      description: 'United Arab Emirates',
      lat: 25.33132,
      lon: 56.34199,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Kalbā',
      description: 'United Arab Emirates',
      lat: 25.0513,
      lon: 56.35422,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Jumayrā',
      description: 'United Arab Emirates',
      lat: 25.20795,
      lon: 55.24969,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Jazīrah al Ḩamrā’',
      description: 'United Arab Emirates',
      lat: 25.7091,
      lon: 55.80772,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Dubai',
      description: 'United Arab Emirates',
      lat: 25.07725,
      lon: 55.30927,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Dibba Al-Fujairah',
      description: 'United Arab Emirates',
      lat: 25.59246,
      lon: 56.26176,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Dibba Al-Hisn',
      description: 'United Arab Emirates',
      lat: 25.61955,
      lon: 56.27291,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Dayrah',
      description: 'United Arab Emirates',
      lat: 25.27143,
      lon: 55.30207,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Sharjah',
      description: 'United Arab Emirates',
      lat: 25.33737,
      lon: 55.41206,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Ash Sha‘m',
      description: 'United Arab Emirates',
      lat: 26.0279,
      lon: 56.08352,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Ar Ruways',
      description: 'United Arab Emirates',
      lat: 24.11028,
      lon: 52.73056,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Manāmah',
      description: 'United Arab Emirates',
      lat: 25.3299,
      lon: 56.02188,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Ḩamrīyah',
      description: 'United Arab Emirates',
      lat: 25.47819,
      lon: 55.53377,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Ḩattā',
      description: 'United Arab Emirates',
      lat: 24.80073,
      lon: 56.12726,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Fujairah City',
      description: 'United Arab Emirates',
      lat: 25.11641,
      lon: 56.34141,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Ain City',
      description: 'United Arab Emirates',
      lat: 24.19167,
      lon: 55.76056,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Ajman City',
      description: 'United Arab Emirates',
      lat: 25.40177,
      lon: 55.47878,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Adh Dhayd',
      description: 'United Arab Emirates',
      lat: 25.28812,
      lon: 55.88157,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Abu Dhabi',
      description: 'United Arab Emirates',
      lat: 24.45118,
      lon: 54.39696,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Abū Hayl',
      description: 'United Arab Emirates',
      lat: 25.28413,
      lon: 55.33153,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'As Saţwah',
      description: 'United Arab Emirates',
      lat: 25.22192,
      lon: 55.27459,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Nadd al Ḩumr',
      description: 'United Arab Emirates',
      lat: 25.20131,
      lon: 55.38388,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Lusaylī',
      description: 'United Arab Emirates',
      lat: 24.93138,
      lon: 55.47531,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Suwayḩān',
      description: 'United Arab Emirates',
      lat: 24.46235,
      lon: 55.33715,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Ḩamīdīyah',
      description: 'United Arab Emirates',
      lat: 25.40001,
      lon: 55.52925,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Waheda',
      description: 'United Arab Emirates',
      lat: 25.29173,
      lon: 55.33822,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Twar First',
      description: 'United Arab Emirates',
      lat: 25.27148,
      lon: 55.36165,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'AL Twar Second',
      description: 'United Arab Emirates',
      lat: 25.26309,
      lon: 55.38028,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Qusais Second',
      description: 'United Arab Emirates',
      lat: 25.27148,
      lon: 55.38603,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Karama',
      description: 'United Arab Emirates',
      lat: 25.24004,
      lon: 55.30106,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Hudaiba',
      description: 'United Arab Emirates',
      lat: 25.24151,
      lon: 55.27805,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Knowledge Village',
      description: 'United Arab Emirates',
      lat: 25.10223,
      lon: 55.16433,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'The Palm Jumeirah',
      description: 'United Arab Emirates',
      lat: 25.11607,
      lon: 55.13506,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Za\'abeel',
      description: 'United Arab Emirates',
      lat: 25.22536,
      lon: 55.305,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Oud Metha',
      description: 'United Arab Emirates',
      lat: 25.23685,
      lon: 55.31419,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Bur Dubai',
      description: 'United Arab Emirates',
      lat: 25.26038,
      lon: 55.29891,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Khalifah A City',
      description: 'United Arab Emirates',
      lat: 24.42588,
      lon: 54.605,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Shakhbout City',
      description: 'United Arab Emirates',
      lat: 24.36727,
      lon: 54.63721,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Mirdif',
      description: 'United Arab Emirates',
      lat: 25.22443,
      lon: 55.41412,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Hawr al ‘Anz',
      description: 'United Arab Emirates',
      lat: 25.27744,
      lon: 55.33675,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Mankhūl',
      description: 'United Arab Emirates',
      lat: 25.24612,
      lon: 55.29222,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Būr Sa‘īd',
      description: 'United Arab Emirates',
      lat: 25.261,
      lon: 55.33016,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Nāyf',
      description: 'United Arab Emirates',
      lat: 25.27139,
      lon: 55.30323,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Murar al Qadīm',
      description: 'United Arab Emirates',
      lat: 25.27576,
      lon: 55.30738,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Ar Riqqah',
      description: 'United Arab Emirates',
      lat: 25.26797,
      lon: 55.31272,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Warqaa',
      description: 'United Arab Emirates',
      lat: 25.19272,
      lon: 55.42013,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'International City',
      description: 'United Arab Emirates',
      lat: 25.16383,
      lon: 55.40987,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Dubai Marina',
      description: 'United Arab Emirates',
      lat: 25.08525,
      lon: 55.14646,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Dubai Sports City',
      description: 'United Arab Emirates',
      lat: 25.03878,
      lon: 55.21725,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Dubai Internet City',
      description: 'United Arab Emirates',
      lat: 25.09538,
      lon: 55.16171,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Sufouh',
      description: 'United Arab Emirates',
      lat: 25.12015,
      lon: 55.18285,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Safa',
      description: 'United Arab Emirates',
      lat: 25.17047,
      lon: 55.23336,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Ar Rumaylah',
      description: 'United Arab Emirates',
      lat: 25.40338,
      lon: 55.4334,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Mushayrif',
      description: 'United Arab Emirates',
      lat: 25.40977,
      lon: 55.47106,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Jurf',
      description: 'United Arab Emirates',
      lat: 25.41814,
      lon: 55.50791,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Majaz',
      description: 'United Arab Emirates',
      lat: 25.32354,
      lon: 55.38774,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'As Saţwah Sharq',
      description: 'United Arab Emirates',
      lat: 25.23796,
      lon: 55.28678,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Dubai Festival City',
      description: 'United Arab Emirates',
      lat: 25.22177,
      lon: 55.35733,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Dubai International Financial Centre',
      description: 'United Arab Emirates',
      lat: 25.2106,
      lon: 55.27787,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Downtown Dubai',
      description: 'United Arab Emirates',
      lat: 25.19408,
      lon: 55.2781,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Dubai Investments Park',
      description: 'United Arab Emirates',
      lat: 25.00827,
      lon: 55.15682,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Jebel Ali',
      description: 'United Arab Emirates',
      lat: 25.00255,
      lon: 55.10811,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Bani Yas City',
      description: 'United Arab Emirates',
      lat: 24.30978,
      lon: 54.62944,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Musaffah',
      description: 'United Arab Emirates',
      lat: 24.35893,
      lon: 54.48267,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Shamkhah City',
      description: 'United Arab Emirates',
      lat: 24.39268,
      lon: 54.70779,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Reef Al Fujairah City',
      description: 'United Arab Emirates',
      lat: 25.14479,
      lon: 56.24764,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Wiqan',
      description: 'United Arab Emirates',
      lat: 23.75355,
      lon: 55.32739,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Faqaa',
      description: 'United Arab Emirates',
      lat: 24.71242,
      lon: 55.67048,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Sha\'biyyat Al Hiyar',
      description: 'United Arab Emirates',
      lat: 24.58242,
      lon: 55.7467,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Sha\'biyyat Milе̄hah',
      description: 'United Arab Emirates',
      lat: 25.13518,
      lon: 55.8843,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Umm Al Sheif',
      description: 'United Arab Emirates',
      lat: 25.13227,
      lon: 55.20567,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Bada\'a',
      description: 'United Arab Emirates',
      lat: 25.22462,
      lon: 55.26888,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Muteena',
      description: 'United Arab Emirates',
      lat: 25.27375,
      lon: 55.32265,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Mizhar First',
      description: 'United Arab Emirates',
      lat: 25.24805,
      lon: 55.44128,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Al Mizhar Second',
      description: 'United Arab Emirates',
      lat: 25.24332,
      lon: 55.4619,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Dubai Silicon Oasis',
      description: 'United Arab Emirates',
      lat: 25.11985,
      lon: 55.38718,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Dubai Motor City',
      description: 'United Arab Emirates',
      lat: 25.04593,
      lon: 55.24102,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'DAMAC Hills',
      description: 'United Arab Emirates',
      lat: 25.02924,
      lon: 55.25277,
      tags: ['landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Louvre Museum',
      description: 'Paris, France',
      lat: 48.8606,
      lon: 2.3376,
      tags: ['museum', 'art', 'landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Grand Canyon',
      description: 'Arizona, USA',
      lat: 36.1069,
      lon: -112.1129,
      tags: ['nature', 'park', 'landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Niagara Falls',
      description: 'Ontario, Canada',
      lat: 43.0962,
      lon: -79.0377,
      tags: ['nature', 'waterfall', 'landmark'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Great Barrier Reef',
      description: 'Queensland, Australia',
      lat: -18.2871,
      lon: 147.6992,
      tags: ['nature', 'reef', 'marine'],
      Rating: '',
      Date: '',
      visited: false
    },
    {
      name: 'Serengeti National Park',
      description: 'Tanzania',
      lat: -2.3333,
      lon: 34.8333,
      tags: ['nature', 'wildlife', 'park'],
      Rating: '',
      Date: '',
      visited: false
    }
  ];
  return sample.sort(() => Math.random() - 0.5);
}
