# Cloudflare DNS Manager

A comprehensive tool for managing domains, DNS records, redirects, and zones using the Cloudflare API.

## Prerequisites

- Node.js installed on your system
- A Cloudflare account with API access

## Installation

1. Clone this repository (if you haven't already):
   ```bash
   # If you haven't cloned the repository yet
   git clone https://github.com/yourusername/dns-tools.git
   cd dns-tools/CloudFlare
   
   # If you've already cloned the repository
   cd path/to/dns-tools/CloudFlare
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

You have two options to configure the Cloudflare API credentials:

### Option 1: Using environment variables (recommended)

Create a `.env` file in the CloudFlare directory with the following content:

```
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_API_KEY=your_api_key_here
ERROR_LOG_FILE=cloudflare_errors.log
```

### Option 2: Direct code modification

Open `cloudflare.mjs` and update the API credentials at the top of the file:

```javascript
const ACCOUNT_ID = 'your_account_id';
const API_KEY = 'your_api_key';
```

You can find your Account ID and API Key in your Cloudflare dashboard under "Profile" > "API Tokens".

## Features

- Create and manage domains (zones)
- Add, update, and delete DNS records in bulk
- Configure domain redirects
- Pause/resume zones
- Get DNS nameserver information
- Filter and organize domains
- Error logging to a file

## Usage

This module exports several functions that can be imported and used in other scripts. You can also modify the code at the bottom of `cloudflare.mjs` to run specific operations.

### Working with Domains

```javascript
// Get all domains in your account
await getDomains();

// Get domains containing a specific keyword
await getDomains('mywebsite');

// Get domains and write to file
await writeDomainsToFileByKeyword('mywebsite');

// Write all domains to file (excluding ones in the /domains folder)
await writeDomainsToFileByExclusion('outputFileName.txt');

// Create new domains
await createManyZones(['example1.com', 'example2.com']);

// Delete domains
await deleteManyZones(['example1.com', 'example2.com']);

// Pause or resume domains
await pauseManyZones(['example1.com', 'example2.com'], true); // true to pause, false to resume
```

### Working with DNS Records

```javascript
// Add the same DNS records to multiple domains
const records = [
  {
    type: 'MX',
    host: '',
    value: 'smtp.google.com',
    priority: 1
  },
  {
    type: 'TXT',
    host: '',
    value: 'v=spf1 include:_spf.google.com ~all'
  }
];

await createSameDNSRecordsForManyDomains(['example1.com', 'example2.com'], records);

// Add different records to different domains
const domainRecordsMap = {
  'example1.com': [
    { type: 'TXT', host: '', value: 'verification=abc123' }
  ],
  'example2.com': [
    { type: 'TXT', host: '', value: 'verification=xyz789' }
  ]
};

await createDifferentDNSRecordsForManyDomains(domainRecordsMap);

// Create domain-to-records mapping from a text file
const domainRecordsMap = await createDomainRecordsMapFromTextFile('domains.txt');
await createDifferentDNSRecordsForManyDomains(domainRecordsMap);

// Delete DNS records
await deleteManyFilteredDNSRecords(['example1.com', 'example2.com'], 'spf', 'TXT');
```

### Domain Redirects

```javascript
// Set redirects for multiple domains
await changeManyDomainRedirects(['example1.com', 'example2.com'], 'https://destination.com');
```

### Getting Nameserver Information

```javascript
// Get nameservers for domains
await getManyPendingNameservers(['example1.com', 'example2.com']);
```

## Input File Format for Domain Records

For using `createDomainRecordsMapFromTextFile`, create a text file with tab-separated values:

```
example1.com    google-site-verification=abc123
example2.com    google-site-verification=xyz789
```

Each line contains a domain name, followed by the verification value. The function will create TXT records for each domain with the specified values.

## Error Handling

The script logs errors to `cloudflare_errors.log` in the root directory (or to the file specified in the ERROR_LOG_FILE environment variable). Check this file if operations fail.

## Running the Script

You can run the script directly:

```bash
node cloudflare.mjs
```

By default, the script executes the code in the self-invoking function at the bottom of the file. Uncomment the operations you want to run.

## Examples

### Example: Setting up Google Workspace MX Records

```javascript
const domains = ['example1.com', 'example2.com'];

const gwsRecords = [
  {
    type: 'MX',
    host: '',
    value: 'smtp.google.com',
    priority: 1
  },
  {
    type: 'TXT',
    host: '_dmarc',
    value: 'v=DMARC1; p=none'
  },
  {
    type: 'TXT',
    host: '',
    value: 'v=spf1 include:_spf.google.com ~all'
  }
];

await createSameDNSRecordsForManyDomains(domains, gwsRecords);
```

### Example: Setting Up Domain Verification

```javascript
// From a file
const domainRecordsMap = await createDomainRecordsMapFromTextFile('domains.txt');
await createDifferentDNSRecordsForManyDomains(domainRecordsMap);

// Manually
const verificationMap = {
  'example1.com': [
    { type: 'TXT', host: '', value: 'google-site-verification=abc123' }
  ],
  'example2.com': [
    { type: 'TXT', host: '', value: 'google-site-verification=xyz789' }
  ]
};

await createDifferentDNSRecordsForManyDomains(verificationMap);
``` 