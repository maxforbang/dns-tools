# Porkbun DNS Manager

A simple tool for managing DNS records using the Porkbun API.

## Prerequisites

- [Bun](https://bun.sh/) installed on your system

## Installation

1. Clone this repository (if you haven't already):
   ```bash
   # If you haven't cloned the repository yet
   git clone https://github.com/yourusername/dns-tools.git
   cd dns-tools/porkbun
   
   # If you've already cloned the repository
   cd path/to/dns-tools/porkbun
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Set up your environment variables by creating a `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file with your Porkbun API credentials:
   ```
   PORKBUN_API_KEY=your_api_key_here
   PORKBUN_SECRET_API_KEY=your_secret_api_key_here
   DEFAULT_RECORD_TYPE=TXT
   ```

## Usage

### Option 1: Command-line File Input

This script reads a file where each line contains a domain and the value for its DNS record, separated by whitespace.

```bash
bun run porkbun.ts path/to/input-file.txt [RECORD_TYPE]
```

Or using the npm script:

```bash
bun start path/to/input-file.txt [RECORD_TYPE]
```

Where:
- `path/to/input-file.txt` is the path to your input file
- `RECORD_TYPE` (optional) is the DNS record type (overrides the DEFAULT_RECORD_TYPE in .env)

### Option 2: Hardcoded Domain List

You can also set your domains directly in the code:

1. Open `porkbun.ts` and find the `MANUAL_CONFIG` object near the top
2. Set `USE_MANUAL_CONFIG` to `true`
3. Add your domains and record values to the `domains` array
4. Run the script without any filepath argument:

```bash
bun run porkbun.ts
```

### Input File Format

Each line in the input file should contain a domain and the record value, separated by whitespace:

```
choose-nnn-capital.com google-gws-recovery-domain-verification=59108543
choose-nnn-investing.com google-gws-recovery-domain-verification=59133845
choose-nnn-investments.com google-gws-recovery-domain-verification=59133993
```

## Getting Porkbun API Keys

You can obtain your API keys from the Porkbun dashboard:

1. Go to https://porkbun.com/account/api
2. Create API keys if you haven't already
3. Add the API key and Secret API key to your `.env` file

## Features

- Sets DNS records for multiple domains in batch mode
- Supports TXT records and other record types
- Validates API connection before processing
- Provides detailed error messages for troubleshooting
- Multiple methods to provide domain data and credentials
- Uses Bun's built-in .env file support for secure API key storage 