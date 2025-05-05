import axios from 'axios';
import { promises as fsPromises } from 'fs';
import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';

// Load environment variables from .env file if present
dotenv.config();

// Use environment variables if available, otherwise use hardcoded values
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const API_KEY = process.env.CLOUDFLARE_API_KEY || '';

// Error log file path from env or default
const ERROR_LOG_FILE = process.env.ERROR_LOG_FILE || 'cloudflare_errors.log';

// Store the original console.error
const originalConsoleError = console.error;

// Override console.error to also write to file
console.error = async (...args) => {
	// Call original console.error
	originalConsoleError.apply(console, args);

	try {
		// Format the error message
		const errorMessage = args.map((arg) => (arg instanceof Error ? `${arg.message}\n${arg.stack}` : typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg))).join(' ');

		// Append to log file with timestamp
		await fs.appendFile(ERROR_LOG_FILE, `${new Date().toISOString()}: ${errorMessage}\n`);
	} catch (err) {
		// If logging fails, call original console.error
		originalConsoleError('Error writing to cloudflare_errors.log:', err);
	}
};

const options = (method, url, queryParams, data) => {
	return {
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
		method,
		url: `${url}${
			Object.keys(queryParams || {}).length
				? '?' +
				  Object.entries(queryParams)
						.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
						.join('&')
				: ''
		}`,
		data,
	};
};

export async function cloudflareRequest({ method = 'GET', url, queryParams = {}, body = {} }) {
	try {
		const { data } = await axios.request(options(method, url, queryParams, body));
		return data;
	} catch (error) {
		const errorDetails = error.response?.data?.errors?.[0]?.message || error.message;
		console.error(
			`Cloudflare API request failed:\n` + `URL: ${url}\n` + `Method: ${method}\n` + `Query Params: ${JSON.stringify(queryParams)}\n` + `Body: ${JSON.stringify(body)}\n` + `Error: ${errorDetails}\n`
			// + `Stack: ${error.stack}`
		);
		throw new Error(errorDetails);
	}
}

export async function getDomains(contains, excludeExpired = true, excludePaused = true) {
	const url = 'https://api.cloudflare.com/client/v4/zones';
	let allResults = [];
	let page = 1;
	let hasMorePages = true;

	while (hasMorePages) {
		const queryParams = {
			per_page: 50,
			page: page,
			...(contains ? { name: `contains:${contains}` } : {}),
		};

		console.log(`Fetching page ${page} of domains...`);
		const { result, result_info } = await cloudflareRequest({ url, queryParams });

		allResults = allResults.concat(result);

		if (result_info.page * result_info.per_page >= result_info.total_count) {
			hasMorePages = false;
		} else {
			page++;
		}
	}

	allResults = allResults
  .map(({ id, name, created_on, status }) => {
    return { id, name, created_on, status };
  })

  console.log("Before filtering:", allResults.length);

  if (excludeExpired) {
    allResults = allResults.filter(({ created_on }) => created_on > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()) // only include domains that were created in the last year
  }

  if (excludePaused) {
    allResults = allResults.filter(({ status }) => status !== 'paused')
  }

  console.log("After filtering:", allResults.length);

  return allResults.sort((a, b) => new Date(a.created_on) - new Date(b.created_on));

  // -- Result example:
  // {
  //   id: '9c90cc02b7e7e1ed7f4e399ab1877f4b',
  //   name: 'trywinningdigital.com',
  //   status: 'active',
  //   paused: false,
  //   type: 'full',
  //   development_mode: 0,
  //   name_servers: [ 'arnold.ns.cloudflare.com', 'lola.ns.cloudflare.com' ],
  //   original_name_servers: null,
  //   original_registrar: null,
  //   original_dnshost: null,
  //   modified_on: '2025-04-15T04:32:22.573349Z',
  //   created_on: '2024-03-06T04:22:37.872895Z',
  //   activated_on: '2024-03-06T04:22:39.020823Z',
  //   meta: {
  //     step: 4,
  //     custom_certificate_quota: 0,
  //     page_rule_quota: 3,
  //     phishing_detected: false
  //   },
  //   owner: { id: null, type: 'user', email: null },
  //   account: {
  //     id: 'f76f5d4e60fe2d6a935fb25e7ee8c803',
  //     name: "Purchasing@strukter.io's Account"
  //   },
  //   tenant: { id: null, name: null },
  //   tenant_unit: { id: null },
  //   permissions: [
  //     '#zone:read',
  //     '#zone_settings:read',
  //     '#dns_records:read',
  //     '#dns_records:edit',
  //     '#zone:edit',
  //     '#zone_settings:edit'
  //   ],
  //   plan: {
  //     id: '0feeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  //     name: 'Free Website',
  //     price: 0,
  //     currency: 'USD',
  //     frequency: '',
  //     is_subscribed: false,
  //     can_subscribe: false,
  //     legacy_id: 'free',
  //     legacy_discount: false,
  //     externally_managed: false
  //   }
  // }
}

// E.g. Writes all domains containing 'strukter' to 'strukter.txt'
async function writeDomainsToFileByKeyword(keyword, excludeExpired = true) {
	const response = await getDomains(keyword, excludeExpired);
	await fsPromises.writeFile(`domains/${keyword ?? 'all'}.txt`, JSON.stringify(response, null, 2));
	console.log(`${response.length} ${keyword ?? '(all)'} domains have been written to domains/${keyword ?? 'all'}.txt`);
}

// E.g. Writes all domains in account to 'outputFileName.txt' (except for those in the /domains folder)
async function writeDomainsToFileByExclusion(outputFileName) {
	const domainsDir = './domains';
	const allDomainsFile = path.join(domainsDir, 'all.txt');
	const filteredDomainsFile = path.join(domainsDir, outputFileName);

	// Read all domains
	const allDomainsContent = await fs.readFile(allDomainsFile, 'utf-8');
	const allDomains = new Map(JSON.parse(allDomainsContent).map((domain) => [domain.name, domain.id]));

	// Read and process other .txt files
	const files = await fs.readdir(domainsDir);
	for (const file of files) {
		if (file !== 'all.txt' && file.endsWith('.txt')) {
			const filePath = path.join(domainsDir, file);
			const content = await fs.readFile(filePath, 'utf-8');
			const domains = JSON.parse(content).map((domain) => domain.name);
			domains.forEach((domain) => allDomains.delete(domain));
		}
	}

	// Write filtered domains to file
	const filteredDomains = Array.from(allDomains, ([name, id]) => ({ id, name }));
	await fs.writeFile(filteredDomainsFile, JSON.stringify(filteredDomains, null, 2));

	console.log(`Filtered domains written to ${filteredDomainsFile}`);
}

export async function getZoneId(domain) {
	const url = 'https://api.cloudflare.com/client/v4/zones';
	const queryParams = {
		name: domain,
	};

	const { result } = await cloudflareRequest({ url, queryParams });

	return result[0].id;
}

// Add domain / website to Cloudflare
async function createZone(domain) {
	const url = 'https://api.cloudflare.com/client/v4/zones';
	const body = {
		account: { id: ACCOUNT_ID },
		name: domain,
	};

	const { success, result } = await cloudflareRequest({ method: 'POST', url, body });
	console.log(`Created zone for ${domain}`);
	return { success, result };
}

// Insert a single DNS record
async function insertDNSRecord(zoneId, record) {
	const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
	const method = 'POST';
	
	// Format the record for Cloudflare API
	const formattedRecord = {
		type: record.type.toUpperCase(),
		name: record.host,
		content: record.value,
		ttl: record.ttl || 3600, // Default to 1 hour if not specified
		priority: record.priority,
		proxied: record.proxied || false
	};

	try {
		const { success, result } = await cloudflareRequest({ method, url, body: formattedRecord });
		if (success) {
			console.log(`Created ${record.type} record for ${result.name}`);
			return { success, result };
		} else {
			throw new Error(`Failed to create DNS record: ${JSON.stringify(result)}`);
		}
	} catch (error) {
		console.error(`Failed to create DNS record:`, error.message);
		throw error;
	}
}

// Insert multiple DNS records for a single domain
async function insertDNSRecords(domain, records) {
	try {
		const zoneId = await getZoneId(domain);
		console.log(`Inserting ${records.length} DNS records for ${domain} (zoneId: ${zoneId})`);
		
		const results = [];
		for (let record of records) {
			if (record.host === '@' || record.host === '') {
				record.host = domain;
			}
      
      try {
				const result = await insertDNSRecord(zoneId, record);
				results.push({ 
					success: true, 
					domain, 
					record: {
						type: record.type,
						host: record.host,
						value: record.value
					} 
				});
			} catch (error) {
				console.error(`Failed to create ${record.type} record (${record.host}) for ${domain}:`, error.message);
				results.push({ 
					success: false, 
					domain, 
					record: {
						type: record.type,
						host: record.host,
						value: record.value
					},
					error: error.message
				});
			}
		}
		
		return results;
	} catch (error) {
		console.error(`Failed to get zoneId for ${domain}:`, error.message);
		return [{ success: false, domain, error: error.message }];
	}
}

// Insert the same DNS records for multiple domains
async function createSameDNSRecordsForManyDomains(domains, records) {
	const results = [];
	
	for (const domain of domains) {
		try {
			console.log(`Using same records for ${domain} (${records.length} records)`);
			
			// Insert the records for this domain
			const domainResults = await insertDNSRecords(domain, records);
			results.push(...domainResults);
			
			// Log summary for this domain
			const successCount = domainResults.filter(r => r.success).length;
			const failCount = domainResults.length - successCount;
			console.log(`Domain ${domain}: ${successCount} records created, ${failCount} failed`);
		} catch (error) {
			console.error(`Failed to process records for ${domain}:`, error.message);
			results.push({ success: false, domain, error: error.message });
		}
	}
	
	// Log overall summary
	const successfulDomains = new Set(results.filter(r => r.success).map(r => r.domain)).size;
	const totalDomains = domains.length;
	console.log(`\nCompleted DNS record creation for ${successfulDomains}/${totalDomains} domains`);
	
	return results;
}

// Insert different DNS records for each domain
async function createDifferentDNSRecordsForManyDomains(domainToRecordsMap) {
	const results = [];
	const domains = Object.keys(domainToRecordsMap);
	
	for (const domain of domains) {
		try {
			const domainRecords = domainToRecordsMap[domain];
			console.log(`Using custom records for ${domain} (${domainRecords.length} records)`);
			
			// Insert the records for this domain
			const domainResults = await insertDNSRecords(domain, domainRecords);
			results.push(...domainResults);
			
			// Log summary for this domain
			const successCount = domainResults.filter(r => r.success).length;
			const failCount = domainResults.length - successCount;
			console.log(`Domain ${domain}: ${successCount} records created, ${failCount} failed`);
		} catch (error) {
			console.error(`Failed to process records for ${domain}:`, error.message);
			results.push({ success: false, domain, error: error.message });
		}
	}
	
	// Log overall summary
	const successfulDomains = new Set(results.filter(r => r.success).map(r => r.domain)).size;
	const totalDomains = domains.length;
	console.log(`\nCompleted DNS record creation for ${successfulDomains}/${totalDomains} domains with custom records`);
	
	return results;
}

// Insert DNS records for multiple domains (legacy function, preserved for compatibility)
async function insertDNSRecordsForManyDomains(domains, records, domainToRecordsMap = null) {
	// If domain mapping is provided, use different records for each domain
	if (domainToRecordsMap) {
		return createDifferentDNSRecordsForManyDomains(domainToRecordsMap);
	}
	
	// Otherwise use the same records for all domains
	return createSameDNSRecordsForManyDomains(domains, records);
}

// Function to read domain-specific records from a file
async function readDomainRecordsFromFile(filePath) {
	try {
		const content = await fsPromises.readFile(filePath, 'utf-8');
		return JSON.parse(content);
	} catch (error) {
		console.error(`Error reading domain records file: ${error.message}`);
		return null;
	}
}

// Function to create domain-to-records mapping from a plain text file
// Format in domains.txt is tab-separated: domain<tab>verification-string
async function createDomainRecordsMapFromTextFile(filePath) {
	try {
		const content = await fsPromises.readFile(filePath, 'utf-8');
		const lines = content.split('\n');
		
		const recordsMap = {};
		
		for (const line of lines) {
			// Skip comments and empty lines
			if (!line.trim() || line.trim().startsWith('#')) continue;
			
			// Parse the line (tab-separated values)
			const parts = line.trim().split(/\t+/);
			
			// Minimum required: domain and verification string (at least 2 parts)
			if (parts.length < 2) {
				console.error(`Invalid line format in records file: ${line}`);
				continue;
			}
			
			const domain = parts[0];
			const value = parts[1];
			
			// Initialize domain record array if it doesn't exist
			if (!recordsMap[domain]) {
				recordsMap[domain] = [];
			}
			
			// Create the record object for TXT verification record
			const record = {
				type: 'TXT',
				host: '', // Root domain
				value: value,
				ttl: 3600
			};
			
			// Add the record to the map
			recordsMap[domain].push(record);
		}
		
		return recordsMap;
	} catch (error) {
		console.error(`Error reading domain records text file: ${error.message}`);
		return null;
	}
}

// Example usage:
// Create a text file with domain-specific records
// domains.txt format (record_type is optional, defaults to TXT):
// example.com TXT txt-record "v=spf1 include:_spf.google.com ~all"
// example.com MX "" smtp.google.com 1 3600 false
// example2.com dkim google-site-verification=abc123  # This defaults to TXT

// Then use it:
// const domainRecordsMap = await createDomainRecordsMapFromTextFile('domains.txt');
// await insertDNSRecordsForManyDomains(domains, defaultRecords, domainRecordsMap);

async function deleteZone(domain) {
	const zoneId = await getZoneId(domain);
	const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}`;
	const method = 'DELETE';
	const { success, result } = await cloudflareRequest({ method, url });
	console.log(`Deleted zone for ${domain}`);
	return { success, result };
}

async function pauseZone(domain, pause = true) {
	try {
		const zoneId = await getZoneId(domain);
		const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}`;
		const method = 'PATCH';
		const body = { paused: pause };
		
		const { success, result } = await cloudflareRequest({ method, url, body });
		
		if (success) {
			console.log(`${pause ? 'Paused' : 'Resumed'} zone for ${domain}`);
			return { success, result };
		} else {
			throw new Error(`Failed to ${pause ? 'pause' : 'resume'} zone`);
		}
	} catch (error) {
		console.error(`Failed to ${pause ? 'pause' : 'resume'} zone for ${domain}:`, error.message);
		throw error;
	}
}

async function pauseManyZones(domains, pause = true) {
	const results = [];
	for (const domain of domains) {
		try {
			const result = await pauseZone(domain, pause);
			results.push({ domain, success: result.success });
			console.log(`Successfully ${pause ? 'paused' : 'resumed'} zone for ${domain}`);
		} catch (error) {
			console.error(`Failed to ${pause ? 'pause' : 'resume'} zone for ${domain}:`, error.message);
			results.push({ domain, success: false, error: error.message });
		}
	}
	return results;
}

async function deleteManyZones(domains) {
	const results = [];
	for (const domain of domains) {
		try {
			const result = await deleteZone(domain);
			results.push(result);
		} catch (error) {
			console.error(`Failed to delete zone for domain ${domain}:`, error.message);
		}
	}
}

async function createManyZones(domains) {
	const results = [];
	for (const domain of domains) {
		try {
			const result = await createZone(domain);
			results.push(result);
		} catch (error) {
			console.error(`Failed to create zone for domain ${domain}:`, error.message);
		}
	}
	return results.map(({ success, result }) => {
		const { id, name } = result;
		return { success, id, name };
	});
}

async function getFilteredDNSRecords(zoneId, content, type) {
	const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
	const queryParams = {
		per_page: 9999,
		type,
	};
	const { result } = await cloudflareRequest({ url, queryParams });
	return result.filter((record) => {
		// For DKIM records, also check if the name contains _domainkey or the content string
		if (type === 'TXT' && content === 'dkim') {
			return record.content.includes(content) || record.name.includes('_domainkey');
		}
		return record.content.includes(content);
	});
}

async function deleteDNSRecord(dnsRecord, zoneId) {
	const { id } = dnsRecord;

	const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${id}`;
	const method = 'DELETE';

	const { success, result } = await cloudflareRequest({ method, url });

	if (success) {
		return result;
	} else {
		throw new Error('Failed to delete DNS record');
	}
}

async function deleteFilteredDNSRecords(domain, content, type) {
	const zoneId = await getZoneId(domain);

  console.log(`Getting ${content} ${type} records for ${domain}; zoneId: ${zoneId}`);

  const dnsRecords = await getFilteredDNSRecords(zoneId, content, type);

  console.log(`-- Found ${dnsRecords.length} ${content} ${type} records for ${domain}`);
	for (const dnsRecord of dnsRecords) {
		try {
			await deleteDNSRecord(dnsRecord, zoneId);
			console.log(`Deleted DNS record ${dnsRecords.indexOf(dnsRecord) + 1} for ${domain}`);
		} catch (error) {
			console.error(`Failed to delete DNS record ${dnsRecords.indexOf(dnsRecord) + 1} for ${domain}:`, error);
		}
	}
}

async function deleteManyFilteredDNSRecords(domains, content, type) {
	for (const domain of domains) {
		try {
			await deleteFilteredDNSRecords(domain, content, type);
		} catch (error) {
			console.error(`Failed to delete DNS records for ${domain}:`, error);
		}
	}
}

async function getPageRules(zoneId) {
	const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/pagerules`;
	const queryParams = {
		status: 'active',
		direction: 'desc',
		order: 'priority',
		match: 'all',
	};

	try {
		const { result, success } = await cloudflareRequest({ url, queryParams });
		if (success) {
			return result;
		} else {
			throw new Error('Failed to fetch page rules');
		}
	} catch (error) {
		console.error(`Error fetching page rules for zone ${zoneId}:`, error);
		throw error;
	}
}

async function changeDomainRedirect(domain, newRedirectUrl) {
	try {
		const zoneId = await getZoneId(domain);

		// Get existing page rules
		const pageRules = await getPageRules(zoneId);

		// Find the rule with forwarding_url action
		const forwardingRule = pageRules.find((rule) => rule.actions.some((action) => action.id === 'forwarding_url'));

		// If a forwarding rule exists, delete it
		if (forwardingRule) {
			const deleteUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/pagerules/${forwardingRule.id}`;
			await cloudflareRequest({ method: 'DELETE', url: deleteUrl });
			console.log(`Deleted existing forwarding rule: (${domain} -> ${forwardingRule?.actions[0]?.value?.url ?? 'unknown'})`);
		}

		const formattedDomain = domain.endsWith('/') ? domain.slice(0, -1) : domain;

		// Create new forwarding rule
		const createUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/pagerules`;
		const newRule = {
			targets: [
				{
					target: 'url',
					constraint: {
						operator: 'matches',
						value: `${formattedDomain}/*`,
					},
				},
			],
			actions: [
				{
					id: 'forwarding_url',
					value: {
						url: newRedirectUrl,
						status_code: 301,
					},
				},
			],
			priority: 1,
			status: 'active',
		};

		const { result, success } = await cloudflareRequest({
			method: 'POST',
			url: createUrl,
			body: newRule,
		});

		if (!success) {
			const errorMessage = `Failed to create new forwarding rule: ${JSON.stringify(result, null, 2)}`;
			await fs.appendFile('cloudflare_errors.log', `${new Date().toISOString()}: ${errorMessage}\n`);
			console.error(errorMessage);
			throw new Error('Failed to change domain redirect');
		}
	} catch (error) {
		console.error(`Error changing domain redirect for zone ${zoneId}:`, error);
		const errorMessage = `Error changing domain redirect for zone ${zoneId}: ${error.message}`;
		await fs.appendFile('cloudflare_errors.log', `${new Date().toISOString()}: ${errorMessage}\n`);
		throw error;
	}
}

async function changeManyDomainRedirects(domainNames, newRedirectUrl) {
	for (const domain of domainNames) {
		try {
			await changeDomainRedirect(domain, newRedirectUrl);
			console.log(`Successfully created new forwarding rule: ${domain} -> ${newRedirectUrl}`);
		} catch (error) {
			console.error(`Failed to change redirect for ${domain}:`, error.message);
		}
	}
}

// Add this new function after getZoneId
export async function getPendingNameservers(domain) {
	const zoneId = await getZoneId(domain);
	const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}`;

	const { result } = await cloudflareRequest({ url });

	return result.name_servers; // This will return the assigned Cloudflare nameservers
}

// Add this function to get nameservers for multiple domains
async function getManyPendingNameservers(domains) {
	const results = [];
	for (const domain of domains) {
		try {
			const nameservers = await getPendingNameservers(domain);
			results.push({ domain, nameservers });
			console.log(`Required nameservers for ${domain}:`, nameservers);
		} catch (error) {
			console.error(`Failed to get nameservers for ${domain}:`, error.message);
		}
	}

	// Console log the results here in grouped sets
	const groupedByNameservers = results.reduce((acc, { domain, nameservers }) => {
		const key = JSON.stringify(nameservers);
		if (!acc[key]) {
			acc[key] = {
				nameservers,
				domains: [],
			};
		}
		acc[key].domains.push(domain);
		return acc;
	}, {});

	console.log('\nGrouped domains by nameservers:\n');
	let groupNumber = 1;
	for (const { nameservers, domains } of Object.values(groupedByNameservers)) {
		console.log(`Nameserver Group ${groupNumber}:`);
		nameservers.forEach((ns) => console.log(ns));

		console.log('\nDomains:');
		domains.forEach((domain) => console.log(domain));
		console.log(''); // Empty line between groups
		groupNumber++;
	}

	return results;
}

const domains = [
  'choose-nnn-capital.com',
  'choose-nnn-investing.com',  
];

// GWS Reseller DNS Records for initial setup
const gwsResellerDnsRecords = [
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

(async () => {  
  // ========= DNS Records =========
  
  // --- Add DNS Records for Email Configuration
  
  // await insertDNSRecords(domains[0], gwsResellerDnsRecords); // Add records for a single domain

  // await createSameDNSRecordsForManyDomains(domains, gwsResellerDnsRecords); // Add the same records to all domains
  
  // Add different records to each domain based on mapping (see porkbun/domains.txt or porkbun/README.md for formatting)
  const domainRecordsMap = await createDomainRecordsMapFromTextFile('domains.txt'); 
  await createDifferentDNSRecordsForManyDomains(domainRecordsMap);

	// --- Delete domains (zones)
	// await deleteManyZones(domains);

  // await getDomains()

  // ========= Domains =========

  	// --- Add new domains from other registrars
	// const response = await createManyZones(domains);

	// --- Get required nameservers for pending domains
	// await getManyPendingNameservers(domains);

	// --- Change redirects
	// await changeManyDomainRedirects(domains, 'https://www.salesblaster.ai');

	// --- Pause/Resume domains
	// await pauseManyZones(domains, true); // true to pause, false to resume

	// --- Get domains
  // await writeDomainsToFileByKeyword(); // all unexpired domains
  // await writeDomainsToFileByKeyword(null, false); // all domains (including expired)
	// await writeDomainsToFileByKeyword('winningdigital'); // keyword: what the domain contains (e.g. 'nnn', 'moby', 'strative', 'winningdigital')
	// await writeDomainsToFileByExclusion('outputFileName.txt'); // excludes all .txt files in /domains

	// --- Delete DNS records
	// const zoneId = await getZoneId('discover-mobycap-loans.com');
	// await deleteFilteredDNSRecords(zoneId, 'aspmx', 'MX');
	// await deleteManyFilteredDNSRecords(domains, 'aspmx', 'MX'); // e.g. Delete old Google Workspace MX records

  // --- Remove MX, DMARC, SPF, DKIM records
	// await deleteManyFilteredDNSRecords(domains, '', 'MX');
	// await deleteManyFilteredDNSRecords(domains, 'dmarc', 'TXT');
	// await deleteManyFilteredDNSRecords(domains, 'spf', 'TXT');
	// await deleteManyFilteredDNSRecords(domains, 'dkim', 'TXT');

})();
