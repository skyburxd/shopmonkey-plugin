# shopmonkey

Cursor Plugin wrapping ShopMonkey REST v3 for orders, customers, and vehicles.

Docs: https://shopmonkey.dev

## Install (Grok Bot / Marketplace)

Grok Bot loads plugins only from the Cursor Marketplace/dashboard, not from `~/.cursor/plugins/local`. After the plugin is listed, install it from the plugin page or ask the bot to InstallPlugin.

## Install (Cursor IDE)

This is a local Cursor Plugin (manifest at `.cursor-plugin/plugin.json`).

Open it from the Cursor Plugins UI as a local plugin, or copy this folder into Cursor local plugins directory.

No package dependencies. Run with Node 18 or newer.

## Configure

1. Create an API key in ShopMonkey: Settings, Integration, API Keys (admins; the key is shown once).
2. In Cursor: Plugins, Configure, and set SM_TOKEN to that key.
3. The MCP server sends the ShopMonkey Bearer API key to https://api.shopmonkey.cloud/v3. HTTPS is required. The token is bound to company/location; there are no extra company/location headers.

Do not put the key in this repo or in mcp.json. Only the ${SM_TOKEN} placeholder is used.

## Tools

| Tool | API |
|---|---|
| shopmonkey_auth_status | GET /v3/auth/api_key/status |
| shopmonkey_list_orders | GET /v3/order |
| shopmonkey_get_order | GET /v3/order/:id |
| shopmonkey_create_order | POST /v3/order |
| shopmonkey_search_customers | POST /v3/customer/search |
| shopmonkey_get_customer | GET /v3/customer/:id |
| shopmonkey_create_customer | POST /v3/customer |
| shopmonkey_list_customer_vehicles | GET /v3/customer/:id/vehicle |
| shopmonkey_get_vehicle | GET /v3/vehicle/:id |
| shopmonkey_create_vehicle | POST /v3/vehicle |

Tools pass through official API JSON. See https://shopmonkey.dev
