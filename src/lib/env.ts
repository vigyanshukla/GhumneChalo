export interface EnvCheckResult {
  variable: string;
  status: 'CONFIGURED' | 'MISSING' | 'INVALID_FORMAT';
  isPublic: boolean;
  notes?: string;
}

export function validateEnvironment(): EnvCheckResult[] {
  const checks: Array<{
    name: string;
    isPublic: boolean;
    validator?: (val: string) => boolean;
    formatNote?: string;
  }> = [
    {
      name: 'DATABASE_URL',
      isPublic: false,
      validator: (val) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
      formatNote: 'Must be a valid postgresql:// connection string',
    },
    {
      name: 'DIRECT_URL',
      isPublic: false,
      validator: (val) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
      formatNote: 'Must be a valid postgresql:// connection string',
    },
    {
      name: 'NEXTAUTH_SECRET',
      isPublic: false,
      validator: (val) => val.length >= 16,
      formatNote: 'Should be at least 16 characters',
    },
    {
      name: 'NEXTAUTH_URL',
      isPublic: false,
      validator: (val) => val.startsWith('http://') || val.startsWith('https://'),
      formatNote: 'Must be a valid HTTP/HTTPS URL',
    },
    {
      name: 'GOOGLE_CLIENT_ID',
      isPublic: false,
      validator: (val) => val.includes('.apps.googleusercontent.com') || val.length > 10,
      formatNote: 'Standard Google OAuth client ID format',
    },
    {
      name: 'GOOGLE_CLIENT_SECRET',
      isPublic: false,
      validator: (val) => val.length >= 12,
      formatNote: 'Google OAuth client secret string',
    },
    {
      name: 'GOOGLE_MAPS_API_KEY',
      isPublic: false,
      validator: (val) => val.startsWith('AIza') && val.length > 20,
      formatNote: 'Google Cloud API key format (starts with AIza)',
    },
    {
      name: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
      isPublic: true,
      validator: (val) => val.startsWith('AIza') && val.length > 20,
      formatNote: 'Browser-restricted Google Cloud API key (starts with AIza)',
    },
    {
      name: 'GOOGLE_CLOUD_PROJECT',
      isPublic: false,
      validator: (val) => val.length > 3,
      formatNote: 'Google Cloud Project ID',
    },
    {
      name: 'GOOGLE_CLOUD_LOCATION',
      isPublic: false,
      validator: (val) => val.length > 2,
      formatNote: 'Google Cloud region (e.g. us-central1)',
    },
    {
      name: 'GCP_PROJECT_ID',
      isPublic: false,
      validator: (val) => val.length > 3,
      formatNote: 'Google Cloud Project ID for Vertex AI',
    },
    {
      name: 'GCP_SERVICE_ACCOUNT_EMAIL',
      isPublic: false,
      validator: (val) => val.includes('@') && val.includes('.iam.gserviceaccount.com'),
      formatNote: 'Google Cloud Service Account Email (*.iam.gserviceaccount.com)',
    },
    {
      name: 'GCP_PRIVATE_KEY',
      isPublic: false,
      validator: (val) => val.includes('BEGIN PRIVATE KEY'),
      formatNote: 'RSA private key PEM string',
    },
  ];

  return checks.map((c) => {
    const val = process.env[c.name]?.trim();
    if (!val) {
      return {
        variable: c.name,
        status: 'MISSING',
        isPublic: c.isPublic,
      };
    }

    if (c.validator && !c.validator(val)) {
      return {
        variable: c.name,
        status: 'INVALID_FORMAT',
        isPublic: c.isPublic,
        notes: c.formatNote,
      };
    }

    return {
      variable: c.name,
      status: 'CONFIGURED',
      isPublic: c.isPublic,
    };
  });
}
