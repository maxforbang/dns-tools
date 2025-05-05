import axios, { AxiosError } from 'axios';

// Configuration constants
const API_BASE_URL = 'https://api-ipv4.porkbun.com/api/json/v3'; // Use IPv4-specific endpoint
const USE_MANUAL_CONFIG = false; // Set to true to use the manual config instead of .env or command line args

// Manual configuration - only used if USE_MANUAL_CONFIG is true
const MANUAL_CONFIG: {
  recordType: string;
  domains: [string, string][];
} = {
  recordType: "TXT", // Default record type
  domains: [
    // Array of [domain, content] tuples
    ["nnn-capital.com", "google-gws-recovery-domain-verification=59108443"],
    ["nnn-investing.com", "google-gws-recovery-domain-verification=59134845"],
    // Add more domains as needed
  ]
};

interface PorkbunAuth {
  secretapikey: string;
  apikey: string;
}

interface DNSRecord {
  name: string; // subdomain
  type: string;
  content: string;
  ttl?: string;
  prio?: string;
}

/**
 * Format error response from Porkbun API or Axios
 */
function formatErrorResponse(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    
    // Check for specific status codes
    if (axiosError.response?.status === 403) {
      return "Authentication failed (403 Forbidden). Please check your API credentials.";
    }
    
    if (axiosError.response?.status === 429) {
      return "Rate limit exceeded (429 Too Many Requests). Please wait and try again later.";
    }
    
    // If we have response data, show it
    if (axiosError.response?.data) {
      const data = axiosError.response.data;
      if (typeof data === 'string') {
        return `API Error (${axiosError.response.status}): ${data.substring(0, 200)}`;
      } else if (typeof data === 'object') {
        try {
          return `API Error (${axiosError.response.status}): ${JSON.stringify(data)}`;
        } catch (e) {
          return `API Error (${axiosError.response.status}): ${String(data)}`;
        }
      }
      return `API Error (${axiosError.response.status})`;
    }
    
    // If no response but has a message
    if (axiosError.message) {
      return `Request Error: ${axiosError.message}`;
    }
  }
  
  // Generic fallback
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}

async function createDNSRecord(
  domain: string, 
  record: DNSRecord, 
  auth: PorkbunAuth
): Promise<{ status: string; id?: string; message?: string }> {
  try {
    const endpoint = `${API_BASE_URL}/dns/create/${domain}`;
    // Create request body with auth first, then record data
    const requestBody = {
      secretapikey: auth.secretapikey,
      apikey: auth.apikey,
      ...record
    };
    
    const response = await axios.post(endpoint, requestBody);
    return response.data;
  } catch (error: unknown) {
    return { 
      status: 'ERROR', 
      message: formatErrorResponse(error)
    };
  }
}

async function getDNSRecords(
  domain: string,
  auth: PorkbunAuth
): Promise<{ status: string; records?: DNSRecord[]; message?: string }> {
  try {
    const endpoint = `${API_BASE_URL}/dns/retrieve/${domain}`;
    // Send only auth data in the request body
    const requestBody = {
      secretapikey: auth.secretapikey,
      apikey: auth.apikey
    };
    
    const response = await axios.post(endpoint, requestBody);
    return response.data;
  } catch (error: unknown) {
    return { 
      status: 'ERROR', 
      message: formatErrorResponse(error)
    };
  }
}

// Process domains from a file using Bun's file API
async function processDomainFile(filepath: string, auth: PorkbunAuth, recordType: string = 'TXT'): Promise<void> {
  try {
    const file = Bun.file(filepath);
    const text = await file.text();
    const lines = text.split('\n');

    for (const line of lines) {
      // Skip empty lines or comments
      if (!line.trim() || line.trim().startsWith('#')) continue;
      
      const [domain, content] = line.split(/\s+/);
      if (!domain || !content) {
        console.error(`Invalid line format: ${line}`);
        continue;
      }

      await processRecord(domain, content, auth, recordType);
    }
  } catch (error: unknown) {
    console.error('Error processing file:', error instanceof Error ? error.message : String(error));
  }
}

// Process a list of domain records from in-memory array
async function processDomainList(domains: [string, string][], auth: PorkbunAuth, recordType: string = 'TXT'): Promise<void> {
  for (const [domain, content] of domains) {
    await processRecord(domain, content, auth, recordType);
  }
}

// Common function to process a single domain record
async function processRecord(domain: string, content: string, auth: PorkbunAuth, recordType: string = 'TXT'): Promise<void> {
  // For TXT records, the name field should be blank to set it at root domain
  const record: DNSRecord = {
    name: '', // root domain
    type: recordType,
    content,
    ttl: '600'
  };

  console.log(`Setting ${recordType} record for ${domain} to: ${content}`);
  const result = await createDNSRecord(domain, record, auth);
  
  if (result.status === 'SUCCESS') {
    console.log(`✅ Success! Record ID: ${result.id}`);
  } else {
    console.error(`❌ Failed for ${domain}: ${result.message}`);
  }
  
  // Sleep to avoid rate limiting
  await Bun.sleep(1000);
}

async function testApiConnection(auth: PorkbunAuth): Promise<boolean> {
  try {
    console.log("Testing API connection...");
    
    // Format the request body correctly according to Porkbun API docs
    const requestBody = {
      secretapikey: auth.secretapikey,
      apikey: auth.apikey
    };

    console.log(`Using API endpoint: ${API_BASE_URL}/ping`);
    
    const response = await axios.post(`${API_BASE_URL}/ping`, requestBody);
    if (response.data.status === 'SUCCESS') {
      console.log(`✅ API connection successful! Your IP: ${response.data.yourIp}`);
      return true;
    } else {
      console.error('❌ API connection failed. Unexpected response:', response.data);
      return false;
    }
  } catch (error: unknown) {
    console.error('❌ API connection failed:', formatErrorResponse(error));
    
    // Add guidance based on error type
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      const requestBodySent = {
        secretapikey: auth.secretapikey,
        apikey: auth.apikey
      };
      
      console.error('\nPossible solutions:');
      console.error('1. Check that your API key and secret are correct');
      console.error('2. Verify that your API key has permissions to manage DNS');
      console.error('3. Ensure your API key is activated (check Porkbun dashboard)');
      console.error('4. Check if 2FA is enabled on your Porkbun account (may require additional auth)');
      
      // Show the exact request body we're sending for debugging
      console.error('\nRequest payload sent:');
      console.error(JSON.stringify(requestBodySent, null, 2));
    }
    
    return false;
  }
}

async function main() {
  // Get API credentials from environment variables (Bun automatically loads .env files)
  const apiKey = process.env.PORKBUN_API_KEY;
  const secretApiKey = process.env.PORKBUN_SECRET_API_KEY;
  const defaultRecordType = process.env.DEFAULT_RECORD_TYPE || 'TXT';
  
  if (!apiKey || !secretApiKey) {
    console.error("❌ ERROR: API credentials not found!");
    console.error("Please add PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY to your .env file");
    console.error("\nExample .env file:");
    console.error("PORKBUN_API_KEY=your_api_key_here");
    console.error("PORKBUN_SECRET_API_KEY=your_secret_api_key_here");
    console.error("DEFAULT_RECORD_TYPE=TXT");
    process.exit(1);
  }

  // Order matters in Porkbun API: secretapikey should be first, then apikey
  const auth: PorkbunAuth = {
    secretapikey: secretApiKey,
    apikey: apiKey
  };

  // Determine mode and settings
  let recordType = defaultRecordType;
  let inputFile = '';

  if (USE_MANUAL_CONFIG) {
    // Use the manually defined configuration
    recordType = MANUAL_CONFIG.recordType;
    console.log("Using manually configured domain list");
  } else {
    // Use command line arguments for file input
    const args = Bun.argv.slice(2);
    
    if (args.length < 1) {
      console.log('Usage: bun run porkbun.ts path/to/input-file.txt [record-type]');
      console.log('Example: bun run porkbun.ts domains.txt TXT');
      console.log('API keys should be defined in your .env file');
      process.exit(1);
    }

    inputFile = args[0];
    // Allow overriding record type from command line
    if (args[1]) {
      recordType = args[1];
    }
  }

  // Verify API credentials with a ping
  const isConnected = await testApiConnection(auth);
  if (!isConnected) {
    process.exit(1);
  }

  if (USE_MANUAL_CONFIG) {
    await processDomainList(MANUAL_CONFIG.domains, auth, recordType);
  } else {
    await processDomainFile(inputFile, auth, recordType);
  }
}

// Run the main function
main().catch((error: unknown) => {
  console.error('Unhandled error:', error instanceof Error ? error.message : String(error));
});
