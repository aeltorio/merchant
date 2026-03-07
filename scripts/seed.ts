#!/usr/bin/env npx tsx
/**
 * Seed script - creates demo data via the API
 *
 * Usage:
 *   npx tsx scripts/seed.ts <api_url> <admin_key>
 *   npx tsx scripts/seed.ts http://localhost:8787 sk_...
 */

// images are embedded as base64 so this file can run even after the PNGs are removed
import { imageMap } from './image_map';

// helper converting SKUs to the filenames we generated above
const skuToImage: Record<string, string> = {
  // tee variants all use the same image regardless of size
  'TEE-BLK-S': 'tee-black.png',
  'TEE-BLK-M': 'tee-black.png',
  'TEE-BLK-L': 'tee-black.png',
  'TEE-WHT-S': 'tee-white.png',
  'TEE-WHT-M': 'tee-white.png',
  'TEE-WHT-L': 'tee-white.png',
  // hoodies share by colour
  'HOOD-BLK-M': 'hoodie-black.png',
  'HOOD-BLK-L': 'hoodie-black.png',
  'HOOD-GRY-M': 'hoodie-white.png',
  'HOOD-GRY-L': 'hoodie-white.png',
  // caps
  'CAP-BLK': 'cap-black.png',
  'CAP-NVY': 'cap-navy.png',
  // sticker pack
  'STICKER-5PK': 'stickers.png',
};

const API_URL = process.argv[2] || 'http://localhost:8787';
const API_KEY = process.argv[3];

if (!API_KEY) {
  console.log(`
🌱 Seed Script - Create demo data

Usage:
  npx tsx scripts/seed.ts <api_url> <admin_key>

Example:
  npx tsx scripts/seed.ts http://localhost:8787 sk_abc123...

First, start the API and create a store:
  npm run dev
  # Then in browser or curl, the first request will prompt you to set up
`);
  process.exit(1);
}

async function api(path: string, body?: any) {
  const res = await fetch(`${API_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${path}: ${err.error?.message || res.statusText}`);
  }

  return res.json();
}

// European countries list
const EUROPEAN_COUNTRIES = [
  { code: 'FR', display_name: 'France', country_name: 'French Republic' },
  { code: 'IT', display_name: 'Italy', country_name: 'Italian Republic' },
  { code: 'DE', display_name: 'Germany', country_name: 'Federal Republic of Germany' },
  { code: 'ES', display_name: 'Spain', country_name: 'Kingdom of Spain' },
  { code: 'NL', display_name: 'Netherlands', country_name: 'Kingdom of the Netherlands' },
  { code: 'BE', display_name: 'Belgium', country_name: 'Kingdom of Belgium' },
  { code: 'AT', display_name: 'Austria', country_name: 'Republic of Austria' },
  { code: 'PT', display_name: 'Portugal', country_name: 'Portuguese Republic' },
  { code: 'GR', display_name: 'Greece', country_name: 'Hellenic Republic' },
  { code: 'PL', display_name: 'Poland', country_name: 'Republic of Poland' },
  { code: 'CZ', display_name: 'Czech Republic', country_name: 'Czech Republic' },
  { code: 'HU', display_name: 'Hungary', country_name: 'Hungary' },
  { code: 'RO', display_name: 'Romania', country_name: 'Romania' },
  { code: 'BG', display_name: 'Bulgaria', country_name: 'Bulgaria' },
  { code: 'HR', display_name: 'Croatia', country_name: 'Republic of Croatia' },
  { code: 'SI', display_name: 'Slovenia', country_name: 'Republic of Slovenia' },
  { code: 'SK', display_name: 'Slovakia', country_name: 'Slovak Republic' },
  { code: 'SE', display_name: 'Sweden', country_name: 'Kingdom of Sweden' },
  { code: 'NO', display_name: 'Norway', country_name: 'Kingdom of Norway' },
  { code: 'DK', display_name: 'Denmark', country_name: 'Kingdom of Denmark' },
  { code: 'FI', display_name: 'Finland', country_name: 'Republic of Finland' },
  { code: 'IE', display_name: 'Ireland', country_name: 'Republic of Ireland' },
  { code: 'LU', display_name: 'Luxembourg', country_name: 'Grand Duchy of Luxembourg' },
  { code: 'MT', display_name: 'Malta', country_name: 'Republic of Malta' },
  { code: 'CY', display_name: 'Cyprus', country_name: 'Republic of Cyprus' },
];

const UK_COUNTRIES = [
  { code: 'GB', display_name: 'United Kingdom', country_name: 'United Kingdom' },
];

const US_COUNTRIES = [
  { code: 'US', display_name: 'United States', country_name: 'United States' },
  { code: 'CA', display_name: 'Canada', country_name: 'Canada' },
];

const OTHER_COUNTRIES = [
  { code: 'AF', display_name: 'Afghanistan', country_name: 'Afghanistan' },
  { code: 'AX', display_name: 'Åland Islands', country_name: 'Åland Islands' },
  { code: 'AL', display_name: 'Albania', country_name: 'Albania' },
  { code: 'DZ', display_name: 'Algeria', country_name: 'Algeria' },
  { code: 'AS', display_name: 'American Samoa', country_name: 'American Samoa' },
  { code: 'AD', display_name: 'Andorra', country_name: 'Andorra' },
  { code: 'AO', display_name: 'Angola', country_name: 'Angola' },
  { code: 'AI', display_name: 'Anguilla', country_name: 'Anguilla' },
  { code: 'AQ', display_name: 'Antarctica', country_name: 'Antarctica' },
  { code: 'AG', display_name: 'Antigua and Barbuda', country_name: 'Antigua and Barbuda' },
  { code: 'AR', display_name: 'Argentina', country_name: 'Argentina' },
  { code: 'AM', display_name: 'Armenia', country_name: 'Armenia' },
  { code: 'AW', display_name: 'Aruba', country_name: 'Aruba' },
  { code: 'AU', display_name: 'Australia', country_name: 'Australia' },
  { code: 'AZ', display_name: 'Azerbaijan', country_name: 'Azerbaijan' },
  { code: 'BS', display_name: 'Bahamas', country_name: 'Bahamas' },
  { code: 'BH', display_name: 'Bahrain', country_name: 'Bahrain' },
  { code: 'BD', display_name: 'Bangladesh', country_name: 'Bangladesh' },
  { code: 'BB', display_name: 'Barbados', country_name: 'Barbados' },
  { code: 'BY', display_name: 'Belarus', country_name: 'Belarus' },
  { code: 'BZ', display_name: 'Belize', country_name: 'Belize' },
  { code: 'BJ', display_name: 'Benin', country_name: 'Benin' },
  { code: 'BM', display_name: 'Bermuda', country_name: 'Bermuda' },
  { code: 'BT', display_name: 'Bhutan', country_name: 'Bhutan' },
  { code: 'BO', display_name: 'Bolivia', country_name: 'Bolivia' },
  { code: 'BA', display_name: 'Bosnia and Herzegovina', country_name: 'Bosnia and Herzegovina' },
  { code: 'BW', display_name: 'Botswana', country_name: 'Botswana' },
  { code: 'BV', display_name: 'Bouvet Island', country_name: 'Bouvet Island' },
  { code: 'BR', display_name: 'Brazil', country_name: 'Brazil' },
  { code: 'VG', display_name: 'British Virgin Islands', country_name: 'British Virgin Islands' },
  { code: 'IO', display_name: 'British Indian Ocean Territory', country_name: 'British Indian Ocean Territory' },
  { code: 'BN', display_name: 'Brunei', country_name: 'Brunei Darussalam' },
  { code: 'BF', display_name: 'Burkina Faso', country_name: 'Burkina Faso' },
  { code: 'BI', display_name: 'Burundi', country_name: 'Burundi' },
  { code: 'KH', display_name: 'Cambodia', country_name: 'Cambodia' },
  { code: 'CM', display_name: 'Cameroon', country_name: 'Cameroon' },
  { code: 'CV', display_name: 'Cape Verde', country_name: 'Cape Verde' },
  { code: 'KY', display_name: 'Cayman Islands', country_name: 'Cayman Islands' },
  { code: 'CF', display_name: 'Central African Republic', country_name: 'Central African Republic' },
  { code: 'TD', display_name: 'Chad', country_name: 'Chad' },
  { code: 'CL', display_name: 'Chile', country_name: 'Chile' },
  { code: 'CN', display_name: 'China', country_name: 'China' },
  { code: 'HK', display_name: 'Hong Kong', country_name: 'Hong Kong' },
  { code: 'MO', display_name: 'Macau', country_name: 'Macau' },
  { code: 'CX', display_name: 'Christmas Island', country_name: 'Christmas Island' },
  { code: 'CC', display_name: 'Cocos Islands', country_name: 'Cocos Islands' },
  { code: 'CO', display_name: 'Colombia', country_name: 'Colombia' },
  { code: 'KM', display_name: 'Comoros', country_name: 'Comoros' },
  { code: 'CG', display_name: 'Republic of the Congo', country_name: 'Republic of the Congo' },
  { code: 'CD', display_name: 'Democratic Republic of the Congo', country_name: 'Democratic Republic of the Congo' },
  { code: 'CK', display_name: 'Cook Islands', country_name: 'Cook Islands' },
  { code: 'CR', display_name: 'Costa Rica', country_name: 'Costa Rica' },
  { code: 'CI', display_name: 'Côte d\'Ivoire', country_name: 'Côte d\'Ivoire' },
  { code: 'CU', display_name: 'Cuba', country_name: 'Cuba' },
  { code: 'DJ', display_name: 'Djibouti', country_name: 'Djibouti' },
  { code: 'DM', display_name: 'Dominica', country_name: 'Dominica' },
  { code: 'DO', display_name: 'Dominican Republic', country_name: 'Dominican Republic' },
  { code: 'EC', display_name: 'Ecuador', country_name: 'Ecuador' },
  { code: 'EG', display_name: 'Egypt', country_name: 'Egypt' },
  { code: 'SV', display_name: 'El Salvador', country_name: 'El Salvador' },
  { code: 'GQ', display_name: 'Equatorial Guinea', country_name: 'Equatorial Guinea' },
  { code: 'ER', display_name: 'Eritrea', country_name: 'Eritrea' },
  { code: 'EE', display_name: 'Estonia', country_name: 'Estonia' },
  { code: 'ET', display_name: 'Ethiopia', country_name: 'Ethiopia' },
  { code: 'FK', display_name: 'Falkland Islands', country_name: 'Falkland Islands' },
  { code: 'FO', display_name: 'Faroe Islands', country_name: 'Faroe Islands' },
  { code: 'FJ', display_name: 'Fiji', country_name: 'Fiji' },
  { code: 'GF', display_name: 'French Guiana', country_name: 'French Guiana' },
  { code: 'PF', display_name: 'French Polynesia', country_name: 'French Polynesia' },
  { code: 'TF', display_name: 'French Southern Territories', country_name: 'French Southern Territories' },
  { code: 'GA', display_name: 'Gabon', country_name: 'Gabon' },
  { code: 'GM', display_name: 'Gambia', country_name: 'Gambia' },
  { code: 'GE', display_name: 'Georgia', country_name: 'Georgia' },
  { code: 'GH', display_name: 'Ghana', country_name: 'Ghana' },
  { code: 'GI', display_name: 'Gibraltar', country_name: 'Gibraltar' },
  { code: 'GL', display_name: 'Greenland', country_name: 'Greenland' },
  { code: 'GD', display_name: 'Grenada', country_name: 'Grenada' },
  { code: 'GP', display_name: 'Guadeloupe', country_name: 'Guadeloupe' },
  { code: 'GU', display_name: 'Guam', country_name: 'Guam' },
  { code: 'GT', display_name: 'Guatemala', country_name: 'Guatemala' },
  { code: 'GG', display_name: 'Guernsey', country_name: 'Guernsey' },
  { code: 'GN', display_name: 'Guinea', country_name: 'Guinea' },
  { code: 'GW', display_name: 'Guinea-Bissau', country_name: 'Guinea-Bissau' },
  { code: 'GY', display_name: 'Guyana', country_name: 'Guyana' },
  { code: 'HT', display_name: 'Haiti', country_name: 'Haiti' },
  { code: 'HM', display_name: 'Heard Island and McDonald Islands', country_name: 'Heard Island and McDonald Islands' },
  { code: 'VA', display_name: 'Holy See', country_name: 'Holy See' },
  { code: 'HN', display_name: 'Honduras', country_name: 'Honduras' },
  { code: 'IN', display_name: 'India', country_name: 'India' },
  { code: 'ID', display_name: 'Indonesia', country_name: 'Indonesia' },
  { code: 'IR', display_name: 'Iran', country_name: 'Iran' },
  { code: 'IQ', display_name: 'Iraq', country_name: 'Iraq' },
  { code: 'IM', display_name: 'Isle of Man', country_name: 'Isle of Man' },
  { code: 'IL', display_name: 'Israel', country_name: 'Israel' },
  { code: 'JM', display_name: 'Jamaica', country_name: 'Jamaica' },
  { code: 'JP', display_name: 'Japan', country_name: 'Japan' },
  { code: 'JE', display_name: 'Jersey', country_name: 'Jersey' },
  { code: 'JO', display_name: 'Jordan', country_name: 'Jordan' },
  { code: 'KZ', display_name: 'Kazakhstan', country_name: 'Kazakhstan' },
  { code: 'KE', display_name: 'Kenya', country_name: 'Kenya' },
  { code: 'KI', display_name: 'Kiribati', country_name: 'Kiribati' },
  { code: 'KP', display_name: 'North Korea', country_name: 'North Korea' },
  { code: 'KR', display_name: 'South Korea', country_name: 'South Korea' },
  { code: 'KW', display_name: 'Kuwait', country_name: 'Kuwait' },
  { code: 'KG', display_name: 'Kyrgyzstan', country_name: 'Kyrgyzstan' },
  { code: 'LA', display_name: 'Laos', country_name: 'Laos' },
  { code: 'LV', display_name: 'Latvia', country_name: 'Latvia' },
  { code: 'LB', display_name: 'Lebanon', country_name: 'Lebanon' },
  { code: 'LS', display_name: 'Lesotho', country_name: 'Lesotho' },
  { code: 'LR', display_name: 'Liberia', country_name: 'Liberia' },
  { code: 'LY', display_name: 'Libya', country_name: 'Libya' },
  { code: 'LI', display_name: 'Liechtenstein', country_name: 'Liechtenstein' },
  { code: 'LT', display_name: 'Lithuania', country_name: 'Lithuania' },
  { code: 'MK', display_name: 'North Macedonia', country_name: 'North Macedonia' },
  { code: 'MG', display_name: 'Madagascar', country_name: 'Madagascar' },
  { code: 'MW', display_name: 'Malawi', country_name: 'Malawi' },
  { code: 'MY', display_name: 'Malaysia', country_name: 'Malaysia' },
  { code: 'MV', display_name: 'Maldives', country_name: 'Maldives' },
  { code: 'ML', display_name: 'Mali', country_name: 'Mali' },
  { code: 'MH', display_name: 'Marshall Islands', country_name: 'Marshall Islands' },
  { code: 'MQ', display_name: 'Martinique', country_name: 'Martinique' },
  { code: 'MR', display_name: 'Mauritania', country_name: 'Mauritania' },
  { code: 'MU', display_name: 'Mauritius', country_name: 'Mauritius' },
  { code: 'YT', display_name: 'Mayotte', country_name: 'Mayotte' },
  { code: 'MX', display_name: 'Mexico', country_name: 'Mexico' },
  { code: 'FM', display_name: 'Micronesia', country_name: 'Micronesia' },
  { code: 'MD', display_name: 'Moldova', country_name: 'Moldova' },
  { code: 'MC', display_name: 'Monaco', country_name: 'Monaco' },
  { code: 'MN', display_name: 'Mongolia', country_name: 'Mongolia' },
  { code: 'ME', display_name: 'Montenegro', country_name: 'Montenegro' },
  { code: 'MS', display_name: 'Montserrat', country_name: 'Montserrat' },
  { code: 'MA', display_name: 'Morocco', country_name: 'Morocco' },
  { code: 'MZ', display_name: 'Mozambique', country_name: 'Mozambique' },
  { code: 'MM', display_name: 'Myanmar', country_name: 'Myanmar' },
  { code: 'NA', display_name: 'Namibia', country_name: 'Namibia' },
  { code: 'NR', display_name: 'Nauru', country_name: 'Nauru' },
  { code: 'NP', display_name: 'Nepal', country_name: 'Nepal' },
  { code: 'NC', display_name: 'New Caledonia', country_name: 'New Caledonia' },
  { code: 'NZ', display_name: 'New Zealand', country_name: 'New Zealand' },
  { code: 'NI', display_name: 'Nicaragua', country_name: 'Nicaragua' },
  { code: 'NE', display_name: 'Niger', country_name: 'Niger' },
  { code: 'NG', display_name: 'Nigeria', country_name: 'Nigeria' },
  { code: 'NU', display_name: 'Niue', country_name: 'Niue' },
  { code: 'NF', display_name: 'Norfolk Island', country_name: 'Norfolk Island' },
  { code: 'MP', display_name: 'Northern Mariana Islands', country_name: 'Northern Mariana Islands' },
  { code: 'OM', display_name: 'Oman', country_name: 'Oman' },
  { code: 'PK', display_name: 'Pakistan', country_name: 'Pakistan' },
  { code: 'PW', display_name: 'Palau', country_name: 'Palau' },
  { code: 'PS', display_name: 'Palestine', country_name: 'Palestine' },
  { code: 'PA', display_name: 'Panama', country_name: 'Panama' },
  { code: 'PG', display_name: 'Papua New Guinea', country_name: 'Papua New Guinea' },
  { code: 'PY', display_name: 'Paraguay', country_name: 'Paraguay' },
  { code: 'PE', display_name: 'Peru', country_name: 'Peru' },
  { code: 'PH', display_name: 'Philippines', country_name: 'Philippines' },
  { code: 'PN', display_name: 'Pitcairn', country_name: 'Pitcairn' },
  { code: 'PR', display_name: 'Puerto Rico', country_name: 'Puerto Rico' },
  { code: 'QA', display_name: 'Qatar', country_name: 'Qatar' },
  { code: 'RE', display_name: 'Réunion', country_name: 'Réunion' },
  { code: 'RU', display_name: 'Russia', country_name: 'Russia' },
  { code: 'RW', display_name: 'Rwanda', country_name: 'Rwanda' },
  { code: 'BL', display_name: 'Saint Barthélemy', country_name: 'Saint Barthélemy' },
  { code: 'SH', display_name: 'Saint Helena', country_name: 'Saint Helena' },
  { code: 'KN', display_name: 'Saint Kitts and Nevis', country_name: 'Saint Kitts and Nevis' },
  { code: 'LC', display_name: 'Saint Lucia', country_name: 'Saint Lucia' },
  { code: 'MF', display_name: 'Saint Martin', country_name: 'Saint Martin' },
  { code: 'SX', display_name: 'Sint Maarten', country_name: 'Sint Maarten' },
  { code: 'PM', display_name: 'Saint Pierre and Miquelon', country_name: 'Saint Pierre and Miquelon' },
  { code: 'VC', display_name: 'Saint Vincent and the Grenadines', country_name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', display_name: 'Samoa', country_name: 'Samoa' },
  { code: 'SM', display_name: 'San Marino', country_name: 'San Marino' },
  { code: 'ST', display_name: 'São Tomé and Príncipe', country_name: 'São Tomé and Príncipe' },
  { code: 'SA', display_name: 'Saudi Arabia', country_name: 'Saudi Arabia' },
  { code: 'SN', display_name: 'Senegal', country_name: 'Senegal' },
  { code: 'RS', display_name: 'Serbia', country_name: 'Serbia' },
  { code: 'SC', display_name: 'Seychelles', country_name: 'Seychelles' },
  { code: 'SL', display_name: 'Sierra Leone', country_name: 'Sierra Leone' },
  { code: 'SG', display_name: 'Singapore', country_name: 'Singapore' },
  { code: 'SB', display_name: 'Solomon Islands', country_name: 'Solomon Islands' },
  { code: 'SO', display_name: 'Somalia', country_name: 'Somalia' },
  { code: 'ZA', display_name: 'South Africa', country_name: 'South Africa' },
  { code: 'GS', display_name: 'South Georgia and the South Sandwich Islands', country_name: 'South Georgia and the South Sandwich Islands' },
  { code: 'SS', display_name: 'South Sudan', country_name: 'South Sudan' },
  { code: 'ES', display_name: 'Spain', country_name: 'Spain' },
  { code: 'LK', display_name: 'Sri Lanka', country_name: 'Sri Lanka' },
  { code: 'SD', display_name: 'Sudan', country_name: 'Sudan' },
  { code: 'SR', display_name: 'Suriname', country_name: 'Suriname' },
  { code: 'SJ', display_name: 'Svalbard and Jan Mayen', country_name: 'Svalbard and Jan Mayen' },
  { code: 'SZ', display_name: 'Eswatini', country_name: 'Eswatini' },
  { code: 'CH', display_name: 'Switzerland', country_name: 'Switzerland' },
  { code: 'SY', display_name: 'Syria', country_name: 'Syria' },
  { code: 'TW', display_name: 'Taiwan', country_name: 'Taiwan' },
  { code: 'TJ', display_name: 'Tajikistan', country_name: 'Tajikistan' },
  { code: 'TZ', display_name: 'Tanzania', country_name: 'Tanzania' },
  { code: 'TH', display_name: 'Thailand', country_name: 'Thailand' },
  { code: 'TL', display_name: 'Timor-Leste', country_name: 'Timor-Leste' },
  { code: 'TG', display_name: 'Togo', country_name: 'Togo' },
  { code: 'TK', display_name: 'Tokelau', country_name: 'Tokelau' },
  { code: 'TO', display_name: 'Tonga', country_name: 'Tonga' },
  { code: 'TT', display_name: 'Trinidad and Tobago', country_name: 'Trinidad and Tobago' },
  { code: 'TN', display_name: 'Tunisia', country_name: 'Tunisia' },
  { code: 'TR', display_name: 'Turkey', country_name: 'Turkey' },
  { code: 'TM', display_name: 'Turkmenistan', country_name: 'Turkmenistan' },
  { code: 'TC', display_name: 'Turks and Caicos Islands', country_name: 'Turks and Caicos Islands' },
  { code: 'TV', display_name: 'Tuvalu', country_name: 'Tuvalu' },
  { code: 'UG', display_name: 'Uganda', country_name: 'Uganda' },
  { code: 'UA', display_name: 'Ukraine', country_name: 'Ukraine' },
  { code: 'AE', display_name: 'United Arab Emirates', country_name: 'United Arab Emirates' },
  { code: 'UY', display_name: 'Uruguay', country_name: 'Uruguay' },
  { code: 'UZ', display_name: 'Uzbekistan', country_name: 'Uzbekistan' },
  { code: 'VU', display_name: 'Vanuatu', country_name: 'Vanuatu' },
  { code: 'VE', display_name: 'Venezuela', country_name: 'Venezuela' },
  { code: 'VN', display_name: 'Vietnam', country_name: 'Vietnam' },
  { code: 'VI', display_name: 'US Virgin Islands', country_name: 'US Virgin Islands' },
  { code: 'WF', display_name: 'Wallis and Futuna', country_name: 'Wallis and Futuna' },
  { code: 'EH', display_name: 'Western Sahara', country_name: 'Western Sahara' },
  { code: 'YE', display_name: 'Yemen', country_name: 'Yemen' },
  { code: 'ZM', display_name: 'Zambia', country_name: 'Zambia' },
  { code: 'ZW', display_name: 'Zimbabwe', country_name: 'Zimbabwe' },
];

async function seedRegions() {
  console.log('💱 Creating currencies...');
  const currencies = await Promise.all([
    api('/v1/regions/currencies', {
      code: 'EUR',
      display_name: 'Euro',
      symbol: '€',
      decimal_places: 2,
    }),
    api('/v1/regions/currencies', {
      code: 'GBP',
      display_name: 'British Pound',
      symbol: '£',
      decimal_places: 2,
    }),
    api('/v1/regions/currencies', {
      code: 'USD',
      display_name: 'US Dollar',
      symbol: '$',
      decimal_places: 2,
    }),
  ]);

  const currencyMap = {
    EUR: currencies[0].id,
    GBP: currencies[1].id,
    USD: currencies[2].id,
  };

  console.log('🌍 Creating countries...');
  const allCountries = [...EUROPEAN_COUNTRIES, ...UK_COUNTRIES, ...US_COUNTRIES, ...OTHER_COUNTRIES];
  
  // Deduplicate by country code (keep first occurrence)
  const seenCodes = new Set<string>();
  const uniqueCountries = allCountries.filter((country) => {
    if (seenCodes.has(country.code)) {
      return false;
    }
    seenCodes.add(country.code);
    return true;
  });
  
  const countryMap: Record<string, string> = {};

  for (const country of uniqueCountries) {
    const created = await api('/v1/regions/countries', country);
    countryMap[country.code] = created.id;
  }

  console.log('🏢 Creating warehouses...');
  const warehouse_fr = await api('/v1/regions/warehouses', {
    display_name: 'France Distribution Center',
    address_line1: '218 route Notre Dame de la Gorge',
    city: 'Les Contamines-Montjoie',
    postal_code: '74170',
    country_code: 'FR',
    priority: 1,
  });

  const warehouse_it = await api('/v1/regions/warehouses', {
    display_name: 'Italy Distribution Center',
    address_line1: '17 piazza San Marco',
    city: 'Venezia',
    postal_code: '30124',
    country_code: 'IT',
    priority: 2,
  });

  console.log('📦 Creating shipping rates...');
  const shippingRate = await api('/v1/regions/shipping-rates', {
    display_name: 'Standard Shipping',
    description: 'Standard international shipping',
    min_delivery_days: 5,
    max_delivery_days: 10,
  });

  // Add shipping rate prices for each currency
  await api(`/v1/regions/shipping-rates/${shippingRate.id}/prices`, {
    currency_id: currencyMap.EUR,
    amount_cents: 999, // €9.99
  });

  await api(`/v1/regions/shipping-rates/${shippingRate.id}/prices`, {
    currency_id: currencyMap.GBP,
    amount_cents: 799, // £7.99
  });

  await api(`/v1/regions/shipping-rates/${shippingRate.id}/prices`, {
    currency_id: currencyMap.USD,
    amount_cents: 1299, // $12.99
  });

  console.log('🗺️ Creating regions...');

  // Europe region
  const region_eu = await api('/v1/regions', {
    display_name: 'Europe',
    currency_id: currencyMap.EUR,
    is_default: true,
  });

  // Add countries to Europe
  for (const country of EUROPEAN_COUNTRIES) {
    await api(`/v1/regions/${region_eu.id}/countries`, {
      country_id: countryMap[country.code],
    });
  }

  // Add warehouses to Europe
  await api(`/v1/regions/${region_eu.id}/warehouses`, { warehouse_id: warehouse_fr.id });
  await api(`/v1/regions/${region_eu.id}/warehouses`, { warehouse_id: warehouse_it.id });

  // Add shipping rates to Europe
  await api(`/v1/regions/${region_eu.id}/shipping-rates`, { shipping_rate_id: shippingRate.id });

  // UK region
  const region_uk = await api('/v1/regions', {
    display_name: 'United Kingdom',
    currency_id: currencyMap.GBP,
    is_default: false,
  });

  for (const country of UK_COUNTRIES) {
    await api(`/v1/regions/${region_uk.id}/countries`, {
      country_id: countryMap[country.code],
    });
  }

  await api(`/v1/regions/${region_uk.id}/warehouses`, { warehouse_id: warehouse_fr.id });
  await api(`/v1/regions/${region_uk.id}/shipping-rates`, { shipping_rate_id: shippingRate.id });

  // US region
  const region_us = await api('/v1/regions', {
    display_name: 'North America',
    currency_id: currencyMap.USD,
    is_default: false,
  });

  for (const country of US_COUNTRIES) {
    await api(`/v1/regions/${region_us.id}/countries`, {
      country_id: countryMap[country.code],
    });
  }

  await api(`/v1/regions/${region_us.id}/warehouses`, { warehouse_id: warehouse_it.id });
  await api(`/v1/regions/${region_us.id}/shipping-rates`, { shipping_rate_id: shippingRate.id });

  // World region
  const region_world = await api('/v1/regions', {
    display_name: 'Rest of World',
    currency_id: currencyMap.EUR,
    is_default: false,
  });

  for (const country of OTHER_COUNTRIES) {
    await api(`/v1/regions/${region_world.id}/countries`, {
      country_id: countryMap[country.code],
    });
  }

  await api(`/v1/regions/${region_world.id}/warehouses`, { warehouse_id: warehouse_fr.id });
  await api(`/v1/regions/${region_world.id}/shipping-rates`, { shipping_rate_id: shippingRate.id });

  return {
    warehouses: { fr: warehouse_fr.id, it: warehouse_it.id },
    regions: { eu: region_eu.id, uk: region_uk.id, us: region_us.id, world: region_world.id },
  };
}

async function seed() {
  console.log('🌱 Seeding demo data...\n');

  // First, initialize regions and warehouses
  const regionData = await seedRegions();

  // Products
  const products = [
    {
      title: 'Classic Tee',
      description: 'Premium cotton t-shirt. Soft, breathable, and built to last.',
    },
    { title: 'Hoodie', description: 'Cozy pullover hoodie. Perfect for coding sessions.' },
    { title: 'Cap', description: 'Embroidered baseball cap. One size fits most.' },
    {
      title: 'Sticker Pack',
      description: 'Set of 5 die-cut vinyl stickers. Waterproof and durable.',
    },
  ];

  const variants: Record<string, any[]> = {
    'Classic Tee': [
      { sku: 'TEE-BLK-S', title: 'Black / S', price_cents: 2999, weight_g: 180, stock: 50 },
      { sku: 'TEE-BLK-M', title: 'Black / M', price_cents: 2999, weight_g: 200, stock: 75 },
      { sku: 'TEE-BLK-L', title: 'Black / L', price_cents: 2999, weight_g: 220, stock: 60 },
      { sku: 'TEE-WHT-S', title: 'White / S', price_cents: 2999, weight_g: 180, stock: 40 },
      { sku: 'TEE-WHT-M', title: 'White / M', price_cents: 2999, weight_g: 200, stock: 55 },
      { sku: 'TEE-WHT-L', title: 'White / L', price_cents: 2999, weight_g: 220, stock: 45 },
    ],
    Hoodie: [
      { sku: 'HOOD-BLK-M', title: 'Black / M', price_cents: 5999, weight_g: 450, stock: 30 },
      { sku: 'HOOD-BLK-L', title: 'Black / L', price_cents: 5999, weight_g: 500, stock: 25 },
      { sku: 'HOOD-GRY-M', title: 'Gray / M', price_cents: 5999, weight_g: 450, stock: 20 },
      { sku: 'HOOD-GRY-L', title: 'Gray / L', price_cents: 5999, weight_g: 500, stock: 15 },
    ],
    Cap: [
      { sku: 'CAP-BLK', title: 'Black', price_cents: 2499, weight_g: 100, stock: 100 },
      { sku: 'CAP-NVY', title: 'Navy', price_cents: 2499, weight_g: 100, stock: 80 },
    ],
    'Sticker Pack': [
      { sku: 'STICKER-5PK', title: '5 Pack', price_cents: 999, weight_g: 20, stock: 200 },
    ],
  };

  for (const prod of products) {
    console.log(`📦 Creating ${prod.title}...`);

    const product = await api('/v1/products', prod);

    for (const v of variants[prod.title]) {
      const { stock, ...variant } = v;

      // attach an image if we know which file corresponds to this SKU
      const imgFile = skuToImage[variant.sku];
      if (imgFile) {
        variant.image_url = imageMap[imgFile];
      }

      console.log(`   └─ ${variant.sku}`);

      await api(`/v1/products/${product.id}/variants`, variant);

      // Add warehouse inventory
      // Special case: 10 TEE-BLK-S in Italy, rest in France
      if (variant.sku === 'TEE-BLK-S') {
        // 10 in Italy
        await api(`/v1/inventory/${encodeURIComponent(variant.sku)}/warehouse-adjust`, {
          warehouse_id: regionData.warehouses.it,
          delta: 10,
          reason: 'restock',
        });
        // Rest (40, 35, 10) in France based on sizes
        const stock_fr = stock - 10;
        await api(`/v1/inventory/${encodeURIComponent(variant.sku)}/warehouse-adjust`, {
          warehouse_id: regionData.warehouses.fr,
          delta: stock_fr,
          reason: 'restock',
        });
      } else {
        // All other SKUs go to France warehouse
        await api(`/v1/inventory/${encodeURIComponent(variant.sku)}/warehouse-adjust`, {
          warehouse_id: regionData.warehouses.fr,
          delta: stock,
          reason: 'restock',
        });
      }
    }
  };

  // Create test orders
  console.log('\n🛒 Creating test orders...');

  const testOrders = [
    {
      customer_email: 'sarah@example.com',
      items: [
        { sku: 'TEE-BLK-M', qty: 2 },
        { sku: 'CAP-BLK', qty: 1 },
      ],
    },
    {
      customer_email: 'mike@example.com',
      items: [{ sku: 'HOOD-BLK-L', qty: 1 }],
    },
    {
      customer_email: 'emma@example.com',
      items: [
        { sku: 'TEE-WHT-S', qty: 1 },
        { sku: 'TEE-WHT-M', qty: 1 },
        { sku: 'CAP-NVY', qty: 2 },
      ],
    },
    {
      customer_email: 'james@example.com',
      items: [
        { sku: 'HOOD-GRY-M', qty: 1 },
        { sku: 'TEE-BLK-L', qty: 3 },
      ],
    },
    {
      customer_email: 'olivia@example.com',
      items: [{ sku: 'CAP-BLK', qty: 1 }],
    },
    {
      customer_email: 'noah@example.com',
      items: [
        { sku: 'TEE-BLK-S', qty: 1 },
        { sku: 'TEE-WHT-L', qty: 1 },
        { sku: 'HOOD-BLK-M', qty: 1 },
      ],
    },
    {
      customer_email: 'ava@example.com',
      items: [{ sku: 'HOOD-GRY-L', qty: 2 }],
    },
    {
      customer_email: 'liam@example.com',
      items: [
        { sku: 'TEE-BLK-M', qty: 1 },
        { sku: 'CAP-NVY', qty: 1 },
      ],
    },
  ];

  // Skip test orders for now
  // for (const order of testOrders) {
  //   const result = await api('/v1/orders/test', order);
  //   const itemsSummary = order.items.map((i) => `${i.qty}x ${i.sku}`).join(', ');
  //   console.log(`   └─ ${result.number}: ${order.customer_email} (${itemsSummary})`);
  // }

  console.log('\n✅ Done! Demo data created.\n');

  // Show summary
  const { items: allProducts } = await api('/v1/products');
  const { items: allOrders } = await api('/v1/orders');
  console.log(`Products: ${allProducts.length}`);
  console.log(
    `Variants: ${allProducts.reduce((sum: number, p: any) => sum + p.variants.length, 0)}`
  );
  console.log(`Orders: ${allOrders.length}`);

  const totalRevenue = allOrders.reduce((sum: number, o: any) => sum + o.amounts.total_cents, 0);
  console.log(`Revenue: $${(totalRevenue / 100).toFixed(2)}`);

  console.log(`\n📊 Admin dashboard: cd admin && npm run dev`);
  console.log(`   Connect with: ${API_URL}`);
}

seed().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
