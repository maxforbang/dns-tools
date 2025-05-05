# DNS Tools

A collection of tools for managing DNS records across different providers.

## Getting Started

### Clone the Repository

If you've never used Git before, follow these steps to get the code:

1. Install Git
   - Windows: Download and install from [git-scm.com](https://git-scm.com/download/win)
   - Mac: Run `brew install git` (with [Homebrew](https://brew.sh/)) or download from [git-scm.com](https://git-scm.com/download/mac)
   - Linux: Use your package manager (e.g., `sudo apt install git` or `sudo yum install git`)

2. Open a terminal/command prompt

3. Clone the repository by running:
   ```bash
   git clone https://github.com/yourusername/dns-tools.git
   cd dns-tools
   ```

4. Now you can access the individual tools in their respective directories

### Tool Selection

1. Choose the DNS provider you want to work with
2. Navigate to the corresponding directory
3. Follow the setup instructions in the provider's README

## Available Tools

This repository contains tools for managing DNS records with the following providers:

### 1. Porkbun DNS Manager

A simple tool for managing DNS records using the Porkbun API.

- Set DNS records for multiple domains in batch mode
- Support for TXT records and other record types
- Validation of API connection
- Detailed error messages
- Multiple methods to input domain data

[Go to Porkbun DNS Manager →](./porkbun/README.md)

### 2. Cloudflare DNS Manager

A comprehensive tool for managing domains, DNS records, redirects, and zones using the Cloudflare API.

- Create and manage domains (zones)
- Add, update, and delete DNS records in bulk
- Configure domain redirects
- Pause/resume zones
- Get DNS nameserver information
- Filter and organize domains
- Error logging to a file

[Go to Cloudflare DNS Manager →](./CloudFlare/README.md)

## Directory Structure

```
dns-tools/
├── CloudFlare/      # Cloudflare DNS management tools
├── porkbun/         # Porkbun DNS management tools
└── README.md        # This file
```

## Prerequisites

Each tool has its own specific requirements:

- Porkbun tool requires [Bun](https://bun.sh/)
- Cloudflare tool requires Node.js

## License

MIT 