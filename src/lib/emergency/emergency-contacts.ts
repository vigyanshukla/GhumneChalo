import { OfflineEmergencyContact } from './types';

/**
 * Verified national and state emergency service contact numbers for India.
 * Sourced directly from official government emergency services.
 * 
 * Rules:
 * - NEVER fabricate emergency contacts
 * - Provide clear operational hours and descriptions
 * - Available offline without requiring internet connection
 */
export const VERIFIED_EMERGENCY_CONTACTS: OfflineEmergencyContact[] = [
  {
    id: 'contact-112',
    name: 'National Emergency Number (All Services)',
    number: '112',
    category: 'national',
    description: 'Unified single emergency helpline across India for Police, Fire, and Ambulance.',
    availableHours: '24x7',
    isTollFree: true,
    priority: 1,
  },
  {
    id: 'contact-100',
    name: 'Police Control Room',
    number: '100',
    category: 'police',
    description: 'Immediate police response, crime reporting, and emergency public safety dispatch.',
    availableHours: '24x7',
    isTollFree: true,
    priority: 2,
  },
  {
    id: 'contact-108',
    name: 'Ambulance / Emergency Medical Response',
    number: '108',
    category: 'medical',
    description: 'Emergency medical services, trauma response, and government hospital ambulance dispatch.',
    availableHours: '24x7',
    isTollFree: true,
    priority: 3,
  },
  {
    id: 'contact-102',
    name: 'Maternal & Child Health Ambulance',
    number: '102',
    category: 'medical',
    description: 'Basic patient transport and maternal/child medical emergency helpline.',
    availableHours: '24x7',
    isTollFree: true,
    priority: 4,
  },
  {
    id: 'contact-101',
    name: 'Fire & Rescue Services',
    number: '101',
    category: 'national',
    description: 'Fire control room, rescue operations, and hazard containment.',
    availableHours: '24x7',
    isTollFree: true,
    priority: 5,
  },
  {
    id: 'contact-1091',
    name: 'Women in Distress Helpline',
    number: '1091',
    category: 'women',
    description: 'Special police unit for safety, emergency rescue, and harassment support for women travelers.',
    availableHours: '24x7',
    isTollFree: true,
    priority: 6,
  },
  {
    id: 'contact-181',
    name: 'Women Domestic & Travel Safety Helpline',
    number: '181',
    category: 'women',
    description: 'National commission for women helpline providing counseling, shelter, and legal support.',
    availableHours: '24x7',
    isTollFree: true,
    priority: 7,
  },
  {
    id: 'contact-1363',
    name: 'Incredible India Tourist Helpline',
    number: '1363',
    category: 'tourist',
    description: 'Ministry of Tourism 24x7 multi-lingual tourist assistance (English, Hindi, and 10 international languages).',
    availableHours: '24x7',
    isTollFree: true,
    priority: 8,
  },
  {
    id: 'contact-139',
    name: 'Railway Security & Passenger Assistance',
    number: '139',
    category: 'transport',
    description: 'Indian Railways unified passenger helpline for security, medical emergencies on trains, and complaints.',
    availableHours: '24x7',
    isTollFree: true,
    priority: 9,
  },
  {
    id: 'contact-1078',
    name: 'National Disaster Management (NDRF)',
    number: '1078',
    category: 'disaster',
    description: 'Helpline for natural disasters, landslides, flash floods, and rescue operations.',
    availableHours: '24x7',
    isTollFree: true,
    priority: 10,
  },
  {
    id: 'contact-1073',
    name: 'National Highway Road Accident Helpline',
    number: '1073',
    category: 'transport',
    description: 'Emergency rescue, towing, and medical response along Indian National Highways.',
    availableHours: '24x7',
    isTollFree: true,
    priority: 11,
  },
  {
    id: 'contact-kiran',
    name: 'KIRAN Mental Health Crisis Helpline',
    number: '1800-599-0019',
    category: 'medical',
    description: 'Toll-free 24x7 mental health rehabilitation and psychological crisis support.',
    availableHours: '24x7',
    isTollFree: true,
    priority: 12,
  },
];

/**
 * Filter emergency contacts by category
 */
export function getEmergencyContactsByCategory(
  category?: OfflineEmergencyContact['category']
): OfflineEmergencyContact[] {
  if (!category) return VERIFIED_EMERGENCY_CONTACTS;
  return VERIFIED_EMERGENCY_CONTACTS.filter((c) => c.category === category);
}
