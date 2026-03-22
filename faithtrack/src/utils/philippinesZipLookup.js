/**
 * Philippine ZIP (postal) lookup by city/municipality + province.
 * One primary code per locality; users can still correct the field manually.
 */

function norm(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PROVINCE_ALIASES = {
  ncr: 'metro manila',
  mm: 'metro manila',
  'national capital region': 'metro manila',
  'metropolitan manila': 'metro manila',
  'ncr - metro manila': 'metro manila',
  'ncr, metro manila': 'metro manila',
  'ncr metro manila': 'metro manila',
};

function normProvince(p) {
  const n = norm(p);
  return PROVINCE_ALIASES[n] || n;
}

/** Keys: "city|province" (both normalized) */
const ZIP_LOOKUP = {
  // Metro Manila
  'manila|metro manila': '1000',
  'quezon city|metro manila': '1100',
  'caloocan|metro manila': '1400',
  'las pinas|metro manila': '1740',
  'las piñas|metro manila': '1740',
  'makati|metro manila': '1200',
  'malabon|metro manila': '1470',
  'mandaluyong|metro manila': '1550',
  'marikina|metro manila': '1800',
  'muntinlupa|metro manila': '1780',
  'navotas|metro manila': '1485',
  'paranaque|metro manila': '1700',
  'parañaque|metro manila': '1700',
  'pasay|metro manila': '1300',
  'pasig|metro manila': '1600',
  'pateros|metro manila': '1620',
  'san juan|metro manila': '1500',
  'taguig|metro manila': '1630',
  'valenzuela|metro manila': '1440',
  // Rizal
  'antipolo|rizal': '1870',
  'angono|rizal': '1930',
  'baras|rizal': '1970',
  'binangonan|rizal': '1940',
  'cainta|rizal': '1900',
  'cardona|rizal': '1950',
  'jalajala|rizal': '1990',
  'morong|rizal': '1960',
  'pililla|rizal': '1910',
  'rodriguez|rizal': '1860',
  'montalban|rizal': '1860',
  'san mateo|rizal': '1850',
  'tanay|rizal': '1980',
  'taytay|rizal': '1920',
  'teresa|rizal': '1880',
  // Cavite
  'alfonso|cavite': '4123',
  'amadeo|cavite': '4119',
  'bacoor|cavite': '4102',
  'carmona|cavite': '4116',
  'cavite city|cavite': '4100',
  'dasmarinas|cavite': '4114',
  'dasmariñas|cavite': '4114',
  'general emilio aguinaldo|cavite': '4124',
  'general mariano alvarez|cavite': '4117',
  'general trias|cavite': '4107',
  'gen trias|cavite': '4107',
  'imus|cavite': '4103',
  'indang|cavite': '4122',
  'kawit|cavite': '4104',
  'magallanes|cavite': '4113',
  'maragondon|cavite': '4112',
  'mendez|cavite': '4121',
  'naic|cavite': '4110',
  'noveleta|cavite': '4105',
  'rosario|cavite': '4106',
  'silang|cavite': '4118',
  'tagaytay|cavite': '4120',
  'tanza|cavite': '4108',
  'ternate|cavite': '4111',
  'trece martires|cavite': '4109',
  'trece martires city|cavite': '4109',
  // Laguna
  'alaminos|laguna': '4001',
  'bay|laguna': '4033',
  'binan|laguna': '4024',
  'biñan|laguna': '4024',
  'cabuyao|laguna': '4025',
  'calamba|laguna': '4027',
  'calauan|laguna': '4012',
  'cavinti|laguna': '4013',
  'famy|laguna': '4021',
  'kalayaan|laguna': '4015',
  'liliw|laguna': '4004',
  'los banos|laguna': '4030',
  'los baños|laguna': '4030',
  'luisiana|laguna': '4032',
  'lumban|laguna': '4014',
  'mabitac|laguna': '4020',
  'magdalena|laguna': '4007',
  'majayjay|laguna': '4005',
  'nagcarlan|laguna': '4002',
  'paete|laguna': '4016',
  'pagsanjan|laguna': '4008',
  'pakil|laguna': '4017',
  'pangil|laguna': '4018',
  'pila|laguna': '4010',
  'rizal|laguna': '4003',
  'san pablo|laguna': '4000',
  'san pedro|laguna': '4023',
  'santa cruz|laguna': '4009',
  'santa maria|laguna': '4022',
  'santa rosa|laguna': '4026',
  'siniloan|laguna': '4019',
  'victoria|laguna': '4011',
  // Batangas
  'agoncillo|batangas': '4211',
  'alitagtag|batangas': '4205',
  'balayan|batangas': '4213',
  'balete|batangas': '4219',
  'batangas city|batangas': '4200',
  'bauan|batangas': '4201',
  'calaca|batangas': '4212',
  'calatagan|batangas': '4215',
  'cuenca|batangas': '4222',
  'ibaan|batangas': '4230',
  'laurel|batangas': '4221',
  'lemery|batangas': '4209',
  'lian|batangas': '4216',
  'lipa city|batangas': '4217',
  'lipa|batangas': '4217',
  'lobo|batangas': '4223',
  'mabini|batangas': '4202',
  'malvar|batangas': '4233',
  'mataas na kahoy|batangas': '4223',
  'nasugbu|batangas': '4231',
  'padre garcia|batangas': '4224',
  'rosario|batangas': '4225',
  'san jose|batangas': '4227',
  'san juan|batangas': '4226',
  'san luis|batangas': '4210',
  'san nicolas|batangas': '4207',
  'san pascual|batangas': '4204',
  'santa teresita|batangas': '4206',
  'sto tomas|batangas': '4234',
  'santo tomas|batangas': '4234',
  'taal|batangas': '4208',
  'talisay|batangas': '4220',
  'tanauan|batangas': '4232',
  'taysan|batangas': '4228',
  'tingloy|batangas': '4203',
  'tuy|batangas': '4214',
  // Bulacan
  'angat|bulacan': '3012',
  'baliuag|bulacan': '3006',
  'bocaue|bulacan': '3018',
  'bulacan|bulacan': '3017',
  'bustos|bulacan': '3007',
  'calumpit|bulacan': '3003',
  'doña remedios trinidad|bulacan': '3009',
  'guiguinto|bulacan': '3015',
  'hagonoy|bulacan': '3002',
  'malolos|bulacan': '3000',
  'marilao|bulacan': '3019',
  'meycauayan|bulacan': '3020',
  'norzagaray|bulacan': '3013',
  'obando|bulacan': '3021',
  'pandi|bulacan': '3014',
  'paombong|bulacan': '3001',
  'plaridel|bulacan': '3004',
  'pulilan|bulacan': '3005',
  'san ildefonso|bulacan': '3010',
  'san jose del monte|bulacan': '3023',
  'san miguel|bulacan': '3011',
  'san rafael|bulacan': '3008',
  'santa maria|bulacan': '3022',
  // Pampanga
  'angeles city|pampanga': '2009',
  'angeles|pampanga': '2009',
  'apalit|pampanga': '2016',
  'arayat|pampanga': '2012',
  'bacolor|pampanga': '2001',
  'candaba|pampanga': '2013',
  'floridablanca|pampanga': '2006',
  'guagua|pampanga': '2003',
  'lubao|pampanga': '2005',
  'mabalacat|pampanga': '2010',
  'macabebe|pampanga': '2018',
  'magalang|pampanga': '2011',
  'masantol|pampanga': '2017',
  'mexico|pampanga': '2021',
  'mina|pampanga': '2022',
  'porac|pampanga': '2008',
  'san fernando|pampanga': '2000',
  'san luis|pampanga': '2014',
  'san simon|pampanga': '2015',
  'santa ana|pampanga': '2022',
  'santa rita|pampanga': '2002',
  'santo tomas|pampanga': '2020',
  'sasmuan|pampanga': '2004',
  // Other cities (common registrations)
  'baguio|benguet': '2600',
  'la trinidad|benguet': '2601',
  'olongapo|zambales': '2200',
  'subic|zambales': '2209',
  'tarlac city|tarlac': '2300',
  'tarlac|tarlac': '2300',
  'dagupan|pangasinan': '2400',
  'san carlos|pangasinan': '2420',
  'urdaneta|pangasinan': '2428',
  'laoag|ilocos norte': '2900',
  'vigan|ilocos sur': '2700',
  'lucena|quezon': '4301',
  'tayabas|quezon': '4327',
  'naga|camarines sur': '4400',
  'legazpi|albay': '4500',
  'legaspi|albay': '4500',
  'iriga|camarines sur': '4431',
  'sorsogon city|sorsogon': '4700',
  'roxas city|capiz': '5800',
  'iloilo city|iloilo': '5000',
  'iloilo|iloilo': '5000',
  'bacolod|negros occidental': '6100',
  'cebu city|cebu': '6000',
  'cebu|cebu': '6000',
  'lapu-lapu|cebu': '6015',
  'lapu lapu|cebu': '6015',
  'mandaue|cebu': '6014',
  'talisay|cebu': '6045',
  'tagbilaran|bohol': '6300',
  'dumaguete|negros oriental': '6200',
  'tacloban|leyte': '6500',
  'zamboanga city|zamboanga del sur': '7000',
  'cagayan de oro|misamis oriental': '9000',
  'iligan|lanao del norte': '9200',
  'davao city|davao del sur': '8000',
  'davao|davao del sur': '8000',
  'tagum|davao del norte': '8100',
  'general santos|south cotabato': '9500',
  'koronadal|south cotabato': '9506',
  'cotabato city|maguindanao': '9400',
  'butuan|agusan del norte': '8600',
  'surigao city|surigao del norte': '8400',
  'puerto princesa|palawan': '5300',
};

/**
 * @param {string} cityRaw
 * @param {string} provinceRaw
 * @returns {string} 4-digit ZIP or '' if unknown
 */
export function findZipCode(cityRaw, provinceRaw) {
  const city = norm(cityRaw);
  const province = normProvince(provinceRaw);
  if (!city || !province) return '';

  const tryKey = (c) => ZIP_LOOKUP[`${c}|${province}`];

  let zip = tryKey(city);
  if (zip) return zip;

  const noCitySuffix = city.replace(/\s+city$/, '').trim();
  if (noCitySuffix !== city) {
    zip = tryKey(noCitySuffix);
    if (zip) return zip;
  }

  const noMuniSuffix = city.replace(/\s+municipality$/, '').trim();
  if (noMuniSuffix !== city && noMuniSuffix !== noCitySuffix) {
    zip = tryKey(noMuniSuffix);
    if (zip) return zip;
  }

  return '';
}
