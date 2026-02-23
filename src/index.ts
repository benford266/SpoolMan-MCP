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

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// --- Response formatters ---
// Return short readable text instead of raw JSON.
// Small models (e.g. 4B params) loop when they receive large JSON blobs
// because they can't parse them and keep calling tools trying to "understand".

function formatSpool(s: any): string {
  const name = s.filament?.name || "Unknown filament";
  const vendor = s.filament?.vendor?.name || "Unknown vendor";
  const material = s.filament?.material || "Unknown";
  const remaining =
    s.remaining_weight != null ? Math.round(s.remaining_weight) : null;
  const total = s.filament?.weight ?? s.initial_weight ?? null;
  let weightStr = "Unknown weight";
  if (remaining != null && total != null && total > 0) {
    const pct = Math.round((remaining / total) * 100);
    weightStr = `${remaining}g / ${total}g (${pct}%)`;
  } else if (remaining != null) {
    weightStr = `${remaining}g remaining`;
  }
  const loc = s.location || "No location";
  const archived = s.archived ? " [ARCHIVED]" : "";
  return `Spool #${s.id}: ${name} by ${vendor} | ${material} | ${weightStr} | Location: ${loc}${archived}`;
}

function formatSpoolDetail(s: any): string {
  const lines: string[] = [];
  const name = s.filament?.name || "Unknown filament";
  const vendor = s.filament?.vendor?.name || "Unknown vendor";
  lines.push(`Spool #${s.id}: ${name} by ${vendor}`);

  if (s.filament?.material) lines.push(`  Material: ${s.filament.material}`);

  const remaining =
    s.remaining_weight != null ? Math.round(s.remaining_weight) : null;
  const total = s.filament?.weight ?? s.initial_weight ?? null;
  if (remaining != null && total != null && total > 0) {
    const pct = Math.round((remaining / total) * 100);
    lines.push(`  Remaining: ${remaining}g / ${total}g (${pct}%)`);
  } else if (remaining != null) {
    lines.push(`  Remaining: ${remaining}g`);
  }

  if (s.used_weight != null)
    lines.push(`  Used: ${Math.round(s.used_weight)}g`);
  if (s.location) lines.push(`  Location: ${s.location}`);
  if (s.filament?.color_hex)
    lines.push(`  Color: #${s.filament.color_hex}`);
  if (s.filament?.price != null)
    lines.push(`  Price: $${s.filament.price}`);
  if (s.filament?.settings_extruder_temp)
    lines.push(`  Extruder temp: ${s.filament.settings_extruder_temp}°C`);
  if (s.filament?.settings_bed_temp)
    lines.push(`  Bed temp: ${s.filament.settings_bed_temp}°C`);
  lines.push(`  Status: ${s.archived ? "Archived" : "Active"}`);
  if (s.first_used) lines.push(`  First used: ${s.first_used}`);
  if (s.last_used) lines.push(`  Last used: ${s.last_used}`);
  if (s.comment) lines.push(`  Comment: ${s.comment}`);

  return lines.join("\n");
}

function formatFilament(f: any): string {
  const vendor = f.vendor?.name || "No vendor";
  const price = f.price != null ? `$${f.price}` : "No price";
  const color = f.color_hex ? ` color:#${f.color_hex}` : "";
  return `#${f.id}: ${f.name || "Unnamed"} by ${vendor} | ${f.material || "Unknown"}${color} | ${price}`;
}

function formatVendor(v: any): string {
  let line = `#${v.id}: ${v.name}`;
  if (v.comment) line += ` (${v.comment})`;
  return line;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

// --- Tool definitions ---
// Reduced from 24 to 10 tools. Small models get confused by too many tools
// and loop between them. Each tool has a short, clear description.

const TOOLS = [
  {
    name: "list_spools",
    description:
      "List physical filament spools in inventory. Shows what you have and how much filament is left.",
    inputSchema: {
      type: "object",
      properties: {
        material: {
          type: "string",
          description: "Filter by material (PLA, ABS, PETG, etc.)",
        },
        vendor_name: {
          type: "string",
          description: "Filter by vendor name",
        },
        location: {
          type: "string",
          description: "Filter by storage location",
        },
        limit: {
          type: "number",
          description: "Max results. Default 10.",
        },
      },
    },
  },
  {
    name: "get_spool",
    description: "Get full details of one spool by its ID number.",
    inputSchema: {
      type: "object",
      properties: {
        spool_id: {
          type: "number",
          description: "The spool ID number",
        },
      },
      required: ["spool_id"],
    },
  },
  {
    name: "add_spool",
    description:
      "Add a new physical spool to inventory. Requires the filament type ID.",
    inputSchema: {
      type: "object",
      properties: {
        filament_id: {
          type: "number",
          description: "Filament type ID (use list_filaments to find it)",
        },
        location: { type: "string", description: "Storage location" },
        price: { type: "number", description: "Purchase price" },
        comment: { type: "string", description: "Optional note" },
      },
      required: ["filament_id"],
    },
  },
  {
    name: "update_spool",
    description: "Update a spool's location, comment, or archive it.",
    inputSchema: {
      type: "object",
      properties: {
        spool_id: {
          type: "number",
          description: "The spool ID to update",
        },
        location: { type: "string", description: "New location" },
        comment: { type: "string", description: "New comment" },
        archived: {
          type: "boolean",
          description: "true to archive, false to unarchive",
        },
      },
      required: ["spool_id"],
    },
  },
  {
    name: "use_spool",
    description:
      "Record filament usage from a spool. Specify weight in grams OR length in mm.",
    inputSchema: {
      type: "object",
      properties: {
        spool_id: { type: "number", description: "The spool ID" },
        use_weight: {
          type: "number",
          description: "Grams of filament used",
        },
        use_length: {
          type: "number",
          description: "Millimeters of filament used",
        },
      },
      required: ["spool_id"],
    },
  },
  {
    name: "list_filaments",
    description:
      "List filament types/products in the catalog (not physical stock). Shows names, materials, and vendors.",
    inputSchema: {
      type: "object",
      properties: {
        material: {
          type: "string",
          description: "Filter by material (PLA, ABS, PETG, etc.)",
        },
        vendor_name: {
          type: "string",
          description: "Filter by vendor name",
        },
        limit: {
          type: "number",
          description: "Max results. Default 10.",
        },
      },
    },
  },
  {
    name: "add_filament",
    description: "Add a new filament type/product to the catalog.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Filament name" },
        material: {
          type: "string",
          description: "Material type (PLA, ABS, PETG, etc.)",
        },
        vendor_id: {
          type: "number",
          description: "Vendor ID (use list_vendors to find it)",
        },
        price: { type: "number", description: "Price" },
        color_hex: {
          type: "string",
          description: "Color hex code (e.g. FF5733)",
        },
        weight: {
          type: "number",
          description: "Net weight in grams (e.g. 1000)",
        },
        diameter: {
          type: "number",
          description: "Diameter in mm (1.75 or 2.85)",
        },
      },
      required: ["name", "material"],
    },
  },
  {
    name: "list_vendors",
    description: "List filament vendors/manufacturers.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Filter by vendor name" },
      },
    },
  },
  {
    name: "add_vendor",
    description: "Add a new filament vendor/manufacturer.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Vendor name" },
        comment: {
          type: "string",
          description: "Optional note about the vendor",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "server_info",
    description:
      "Get Spoolman server status, version, and lists of all materials and storage locations in use.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Create MCP server
const server = new Server(
  { name: "spoolman-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
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
      case "list_spools": {
        const params: Record<string, any> = { limit: args?.limit ?? 10 };
        if (args?.material) params["filament.material"] = args.material;
        if (args?.vendor_name)
          params["filament.vendor.name"] = args.vendor_name;
        if (args?.location) params.location = args.location;
        const { data } = await api.get("/spool", { params });
        const spools = data as any[];
        if (spools.length === 0) return textResult("No spools found.");
        const lines = spools.map(formatSpool);
        return textResult(
          `Found ${spools.length} spool(s):\n\n${lines.join("\n")}`
        );
      }

      case "get_spool": {
        const { data } = await api.get(`/spool/${args?.spool_id}`);
        return textResult(formatSpoolDetail(data));
      }

      case "add_spool": {
        const body: Record<string, any> = { filament_id: args?.filament_id };
        if (args?.location) body.location = args.location;
        if (args?.price != null) body.price = args.price;
        if (args?.comment) body.comment = args.comment;
        const { data } = await api.post("/spool", body);
        return textResult(
          `Spool added successfully.\n\n${formatSpoolDetail(data)}`
        );
      }

      case "update_spool": {
        const { spool_id, ...updateData } = args as any;
        const { data } = await api.patch(`/spool/${spool_id}`, updateData);
        return textResult(
          `Spool #${spool_id} updated.\n\n${formatSpoolDetail(data)}`
        );
      }

      case "use_spool": {
        const { spool_id, ...usageData } = args as any;
        const { data } = await api.put(`/spool/${spool_id}/use`, usageData);
        return textResult(
          `Usage recorded for spool #${spool_id}.\n\n${formatSpoolDetail(data)}`
        );
      }

      case "list_filaments": {
        const params: Record<string, any> = { limit: args?.limit ?? 10 };
        if (args?.material) params.material = args.material;
        if (args?.vendor_name) params["vendor.name"] = args.vendor_name;
        const { data } = await api.get("/filament", { params });
        const filaments = data as any[];
        if (filaments.length === 0)
          return textResult("No filament types found.");
        const lines = filaments.map(formatFilament);
        return textResult(
          `Found ${filaments.length} filament type(s):\n\n${lines.join("\n")}`
        );
      }

      case "add_filament": {
        const { data } = await api.post("/filament", args);
        return textResult(`Filament type added: ${formatFilament(data)}`);
      }

      case "list_vendors": {
        const params: Record<string, any> = {};
        if (args?.name) params.name = args.name;
        const { data } = await api.get("/vendor", { params });
        const vendors = data as any[];
        if (vendors.length === 0) return textResult("No vendors found.");
        const lines = vendors.map(formatVendor);
        return textResult(
          `Found ${vendors.length} vendor(s):\n\n${lines.join("\n")}`
        );
      }

      case "add_vendor": {
        const body: Record<string, any> = { name: args?.name };
        if (args?.comment) body.comment = args.comment;
        const { data } = await api.post("/vendor", body);
        return textResult(`Vendor added: ${formatVendor(data)}`);
      }

      case "server_info": {
        const [health, info, materials, locations] = await Promise.all([
          api
            .get("/health")
            .catch(() => ({ data: { status: "unreachable" } })),
          api.get("/info").catch(() => ({ data: {} as any })),
          api.get("/material").catch(() => ({ data: [] })),
          api.get("/location").catch(() => ({ data: [] })),
        ]);

        const lines: string[] = [];
        lines.push(
          `Server: ${health.data.status === "healthy" ? "Healthy" : health.data.status || "Unknown"}`
        );
        if (info.data.version) lines.push(`Version: ${info.data.version}`);
        if (info.data.database_type)
          lines.push(`Database: ${info.data.database_type}`);

        const mats = (materials.data as string[]) || [];
        lines.push(
          `Materials in use: ${mats.length > 0 ? mats.join(", ") : "None"}`
        );

        const locs = (locations.data as string[]) || [];
        lines.push(
          `Storage locations: ${locs.length > 0 ? locs.join(", ") : "None"}`
        );

        return textResult(lines.join("\n"));
      }

      default:
        return errorResult(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || "unknown";
      const message = error.response?.data?.message || error.message;
      return errorResult(`Spoolman API error (${status}): ${message}`);
    }
    return errorResult(`Error: ${error.message}`);
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
