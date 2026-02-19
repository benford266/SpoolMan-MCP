#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";

// Spoolman API configuration
const SPOOLMAN_URL = process.env.SPOOLMAN_URL || "http://localhost:7912";
const API_BASE = `${SPOOLMAN_URL}/api/v1`;

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Tool definitions
const TOOLS = [
  // Vendor tools
  {
    name: "list_vendors",
    description: "List all filament vendors with optional filtering by name",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Filter by vendor name (partial match)" },
        limit: { type: "number", description: "Maximum number of results (default: 50)" },
        offset: { type: "number", description: "Number of results to skip" },
      },
    },
  },
  {
    name: "get_vendor",
    description: "Get details of a specific vendor by ID",
    inputSchema: {
      type: "object",
      properties: {
        vendor_id: { type: "number", description: "Vendor ID" },
      },
      required: ["vendor_id"],
    },
  },
  {
    name: "add_vendor",
    description: "Add a new filament vendor",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Vendor name" },
        comment: { type: "string", description: "Optional comment" },
        empty_spool_weight: { type: "number", description: "Empty spool weight in grams" },
        external_id: { type: "string", description: "External identifier" },
      },
      required: ["name"],
    },
  },

  // Filament tools
  {
    name: "list_filaments",
    description: "List filament TYPES/PRODUCTS (not physical inventory). Use this to see available product SKUs, colors, and specifications. For actual stock/inventory, use list_spools instead.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Filter by filament name (partial match)" },
        vendor_name: { type: "string", description: "Filter by vendor name" },
        material: { type: "string", description: "Filter by material type (e.g., PLA, ABS, PETG)" },
        limit: { type: "number", description: "Maximum number of results (default: 50)" },
        offset: { type: "number", description: "Number of results to skip" },
      },
    },
  },
  {
    name: "get_filament",
    description: "Get details of a specific filament by ID",
    inputSchema: {
      type: "object",
      properties: {
        filament_id: { type: "number", description: "Filament ID" },
      },
      required: ["filament_id"],
    },
  },
  {
    name: "add_filament",
    description: "Add a new filament type",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Filament name" },
        vendor_id: { type: "number", description: "Vendor ID" },
        material: { type: "string", description: "Material type (e.g., PLA, ABS, PETG)" },
        price: { type: "number", description: "Price per unit" },
        density: { type: "number", description: "Density in g/cm³ (e.g., 1.24 for PLA)" },
        diameter: { type: "number", description: "Diameter in mm (typically 1.75 or 2.85)" },
        weight: { type: "number", description: "Full spool net weight in grams (e.g., 1000)" },
        spool_weight: { type: "number", description: "Empty spool weight in grams" },
        color_hex: { type: "string", description: "Color in hex format (e.g., FF5733)" },
        settings_extruder_temp: { type: "number", description: "Extruder temperature in Celsius" },
        settings_bed_temp: { type: "number", description: "Bed temperature in Celsius" },
        comment: { type: "string", description: "Optional comment" },
      },
      required: ["name", "material"],
    },
  },

  // Spool tools
  {
    name: "list_spools",
    description: "List PHYSICAL SPOOLS in inventory (actual stock). Use this to check what's available, how many rolls you have, and remaining filament. Each spool represents one physical roll/unit in stock.",
    inputSchema: {
      type: "object",
      properties: {
        filament_name: { type: "string", description: "Filter by filament name" },
        filament_id: { type: "number", description: "Filter by filament ID" },
        vendor_name: { type: "string", description: "Filter by vendor name" },
        location: { type: "string", description: "Filter by storage location" },
        material: { type: "string", description: "Filter by material type" },
        archived: { type: "boolean", description: "Filter by archived status (true/false)" },
        limit: { type: "number", description: "Maximum number of results (default: 50)" },
        offset: { type: "number", description: "Number of results to skip" },
      },
    },
  },
  {
    name: "get_spool",
    description: "Get details of a specific spool by ID, including remaining weight and length",
    inputSchema: {
      type: "object",
      properties: {
        spool_id: { type: "number", description: "Spool ID" },
      },
      required: ["spool_id"],
    },
  },
  {
    name: "add_spool",
    description: "Add a new spool to inventory",
    inputSchema: {
      type: "object",
      properties: {
        filament_id: { type: "number", description: "Filament ID" },
        price: { type: "number", description: "Purchase price" },
        initial_weight: { type: "number", description: "Initial filament weight in grams" },
        spool_weight: { type: "number", description: "Empty spool weight in grams" },
        location: { type: "string", description: "Storage location" },
        lot_nr: { type: "string", description: "Lot number" },
        comment: { type: "string", description: "Optional comment" },
      },
      required: ["filament_id"],
    },
  },
  {
    name: "update_spool",
    description: "Update spool information (location, comment, archived status, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        spool_id: { type: "number", description: "Spool ID" },
        location: { type: "string", description: "New storage location" },
        comment: { type: "string", description: "Updated comment" },
        archived: { type: "boolean", description: "Archive status" },
      },
      required: ["spool_id"],
    },
  },
  {
    name: "use_filament",
    description: "Record filament usage from a spool (by weight or length)",
    inputSchema: {
      type: "object",
      properties: {
        spool_id: { type: "number", description: "Spool ID" },
        use_weight: { type: "number", description: "Weight used in grams" },
        use_length: { type: "number", description: "Length used in millimeters" },
      },
      required: ["spool_id"],
    },
  },
  {
    name: "measure_spool",
    description: "Update spool with a new weight measurement",
    inputSchema: {
      type: "object",
      properties: {
        spool_id: { type: "number", description: "Spool ID" },
        weight: { type: "number", description: "Measured weight in grams (spool + remaining filament)" },
      },
      required: ["spool_id", "weight"],
    },
  },

  // Print job tools
  {
    name: "list_print_jobs",
    description: "List all print jobs with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        spool_id: { type: "number", description: "Filter by spool ID" },
        name: { type: "string", description: "Filter by job name" },
        limit: { type: "number", description: "Maximum number of results (default: 50)" },
        offset: { type: "number", description: "Number of results to skip" },
      },
    },
  },
  {
    name: "add_print_job",
    description: "Record a new print job",
    inputSchema: {
      type: "object",
      properties: {
        spool_id: { type: "number", description: "Spool ID used" },
        name: { type: "string", description: "Print job name" },
        weight_used: { type: "number", description: "Filament weight used in grams" },
        started_at: { type: "string", description: "Start time (ISO 8601 format)" },
        completed_at: { type: "string", description: "Completion time (ISO 8601 format)" },
        cost: { type: "number", description: "Calculated cost" },
        revenue: { type: "number", description: "Revenue generated" },
        notes: { type: "string", description: "Additional notes" },
        external_reference: { type: "string", description: "External reference (e.g., gcode filename)" },
      },
      required: ["spool_id"],
    },
  },

  // Utility tools
  {
    name: "list_materials",
    description: "Get a list of all material types in the database",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_locations",
    description: "Get a list of all storage locations",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_health",
    description: "Check Spoolman server health status",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_info",
    description: "Get Spoolman system information (version, database type, directories)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "search_inventory",
    description: "Search across all inventory items (spools, filaments, vendors) with a general query",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        include_archived: { type: "boolean", description: "Include archived spools in results" },
      },
      required: ["query"],
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: "spoolman-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Vendor operations
      case "list_vendors": {
        const params: any = {};
        if (args?.name) params.name = args.name;
        if (args?.limit) params.limit = args.limit;
        if (args?.offset) params.offset = args.offset;
        const response = await api.get("/vendor", { params });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "get_vendor": {
        const response = await api.get(`/vendor/${args?.vendor_id}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "add_vendor": {
        const response = await api.post("/vendor", args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      // Filament operations
      case "list_filaments": {
        const params: any = {};
        if (args?.name) params.name = args.name;
        if (args?.vendor_name) params["vendor.name"] = args.vendor_name;
        if (args?.material) params.material = args.material;
        if (args?.limit) params.limit = args.limit;
        if (args?.offset) params.offset = args.offset;
        const response = await api.get("/filament", { params });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "get_filament": {
        const response = await api.get(`/filament/${args?.filament_id}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "add_filament": {
        const response = await api.post("/filament", args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      // Spool operations
      case "list_spools": {
        const params: any = {};
        if (args?.filament_name) params["filament.name"] = args.filament_name;
        if (args?.filament_id) params["filament.id"] = args.filament_id;
        if (args?.vendor_name) params["filament.vendor.name"] = args.vendor_name;
        if (args?.location) params.location = args.location;
        if (args?.material) params["filament.material"] = args.material;
        if (args?.archived !== undefined) params.allow_archived = args.archived;
        if (args?.limit) params.limit = args.limit;
        if (args?.offset) params.offset = args.offset;
        const response = await api.get("/spool", { params });
        const spools = response.data as any[];

        // Add a summary to help LLMs understand the data
        const summary = {
          total_spools: spools.length,
          spools: spools,
          summary_text: spools.length === 0
            ? "No spools found matching the criteria"
            : `Found ${spools.length} spool(s) in inventory`
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }

      case "get_spool": {
        const response = await api.get(`/spool/${args?.spool_id}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "add_spool": {
        const response = await api.post("/spool", args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "update_spool": {
        const { spool_id, ...updateData } = args as any;
        const response = await api.patch(`/spool/${spool_id}`, updateData);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "use_filament": {
        const { spool_id, ...usageData } = args as any;
        const response = await api.put(`/spool/${spool_id}/use`, usageData);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "measure_spool": {
        const { spool_id, weight } = args as any;
        const response = await api.post(`/spool/${spool_id}/measure`, { weight });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      // Print job operations
      case "list_print_jobs": {
        const params: any = {};
        if (args?.spool_id) params.spool_id = args.spool_id;
        if (args?.name) params.name = args.name;
        if (args?.limit) params.limit = args.limit;
        if (args?.offset) params.offset = args.offset;
        const response = await api.get("/print-job", { params });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "add_print_job": {
        const response = await api.post("/print-job", args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      // Utility operations
      case "list_materials": {
        const response = await api.get("/material");
        const materials = (response.data as string[]) || [];
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                materials: materials,
                count: materials.length,
                message: materials.length > 0
                  ? `Found ${materials.length} material type(s)`
                  : "No materials found"
              }, null, 2),
            },
          ],
        };
      }

      case "list_locations": {
        const response = await api.get("/location");
        const locations = (response.data as string[]) || [];
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                locations: locations,
                count: locations.length,
                message: locations.length > 0
                  ? `Found ${locations.length} storage location(s)`
                  : "No storage locations found"
              }, null, 2),
            },
          ],
        };
      }

      case "get_health": {
        const response = await api.get("/health");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "get_info": {
        const response = await api.get("/info");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "search_inventory": {
        const query = (args?.query as string) || "";
        const includeArchived = args?.include_archived ?? false;

        // Search across spools, filaments, and vendors using correct field-specific parameters
        const [spools, filaments, vendors] = await Promise.all([
          api.get("/spool", {
            params: {
              "filament.name": query,
              allow_archived: includeArchived,
            },
          }).catch(() => ({ data: [] })),
          api.get("/filament", {
            params: { name: query },
          }).catch(() => ({ data: [] })),
          api.get("/vendor", {
            params: { name: query },
          }).catch(() => ({ data: [] })),
        ]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query,
                  results: {
                    spools: spools.data,
                    filaments: filaments.data,
                    vendors: vendors.data,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || "unknown";
      const message = error.response?.data?.message || error.message;
      return {
        content: [
          {
            type: "text",
            text: `Error calling Spoolman API (${status}): ${message}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Spoolman MCP Server running on stdio");
  console.error(`Connected to Spoolman at: ${SPOOLMAN_URL}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
