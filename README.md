# Spoolman MCP Server

A Model Context Protocol (MCP) server for [Spoolman](https://github.com/Donkie/Spoolman), the 3D printer filament inventory management system.

This MCP server allows LLM applications (like Claude Desktop, LM Studio, or other MCP clients) to interact with your Spoolman instance to manage filament inventory, track spools, record print jobs, and more.

## Features

### Vendor Management
- List all vendors with search and filtering
- Get vendor details
- Add new vendors

### Filament Management
- List filaments with filtering by vendor, material type, or name
- Get detailed filament information
- Add new filament types with specifications (density, diameter, temperature settings, colors)

### Spool Inventory
- List spools with advanced filtering (location, material, vendor, archived status)
- Get spool details including remaining weight and length
- Add new spools to inventory
- Update spool information (location, comments, archive status)
- Record filament usage by weight or length
- Measure spool weight to update remaining filament

### Print Job Tracking
- List print jobs with filtering
- Record new print jobs with weight used, cost, and revenue tracking

### Utilities
- List all material types in your inventory
- List all storage locations
- Search across all inventory (spools, filaments, vendors)
- Health check and system information

## Installation

### Prerequisites
- Node.js 18 or higher
- A running Spoolman instance (default: `http://localhost:7912`)

### Setup

1. Clone or navigate to this directory:
```bash
cd /Users/ben/Code/Spoolman-MCP
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript project:
```bash
npm run build
```

## Configuration

### Environment Variables

Set the Spoolman server URL using an environment variable (optional):

```bash
export SPOOLMAN_URL=http://localhost:7912
```

If not set, it defaults to `http://localhost:7912`.

### MCP Client Configuration

#### For Claude Desktop

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "spoolman": {
      "command": "node",
      "args": ["/Code/Spoolman-MCP/dist/index.js"],
      "env": {
        "SPOOLMAN_URL": "http://localhost:7912"
      }
    }
  }
}
```

#### For LM Studio

In LM Studio, go to the MCP configuration and add:

```json
{
  "mcpServers": {
    "spoolman": {
      "command": "node",
      "args": ["/Code/Spoolman-MCP/dist/index.js"],
      "env": {
        "SPOOLMAN_URL": "http://localhost:7912"
      }
    }
  }
}
```

Replace the path and URL as needed for your setup.

## Usage

Once configured, you can interact with your Spoolman inventory using natural language:

### Example Queries

**Inventory Management:**
- "Show me all PLA filaments in stock"
- "List all spools at location 'Drawer A'"
- "What's the remaining weight on spool 5?"
- "Add a new spool of PolyTerra PLA to my inventory"

**Tracking Usage:**
- "Record 25 grams of filament used from spool 3"
- "Log a print job using spool 7, 45 grams used"
- "Update spool 2 weight measurement to 850 grams"

**Searching:**
- "Find all Prusament filaments"
- "Show me archived spools"
- "What materials do I have in inventory?"

**Vendor & Filament Info:**
- "List all vendors"
- "Show details for filament ID 12"
- "Add a new vendor called 'PolyMaker'"

## Available Tools

The MCP server exposes these tools to LLM clients:

### Vendor Tools
- `list_vendors` - List all vendors
- `get_vendor` - Get vendor by ID
- `add_vendor` - Add new vendor

### Filament Tools
- `list_filaments` - List filaments with filtering
- `get_filament` - Get filament by ID
- `add_filament` - Add new filament type

### Spool Tools
- `list_spools` - List spools with filtering
- `get_spool` - Get spool by ID
- `add_spool` - Add new spool
- `update_spool` - Update spool info
- `use_filament` - Record filament usage
- `measure_spool` - Update weight measurement

### Print Job Tools
- `list_print_jobs` - List print jobs
- `add_print_job` - Record new print job

### Utility Tools
- `list_materials` - Get all material types
- `list_locations` - Get all storage locations
- `search_inventory` - Search across all inventory
- `get_health` - Check server health
- `get_info` - Get system information

## Development

### Building
```bash
npm run build
```

### Watch Mode
For development with auto-rebuild:
```bash
npm run watch
```

### Testing Connection
You can test the connection to your Spoolman instance:
```bash
node dist/index.js
```

The server will output connection information to stderr.

## Troubleshooting

### Connection Issues
- Ensure Spoolman is running at the configured URL
- Check that the SPOOLMAN_URL environment variable is set correctly
- Verify no firewall is blocking the connection

### MCP Client Issues
- Restart your MCP client (Claude Desktop, LM Studio, etc.) after configuration changes
- Check the client logs for error messages
- Verify the path to `dist/index.js` is correct in your configuration

## API Reference

This MCP server interfaces with Spoolman API v1. For more details on the Spoolman API:
- [Spoolman Documentation](https://donkie.github.io/Spoolman/)
- [Spoolman GitHub](https://github.com/Donkie/Spoolman)

## License

MIT

## Contributing

Feel free to submit issues or pull requests for improvements.
