---
name: grokbot-shopmonkey-plugin
description: Use when looking up or mutating ShopMonkey orders, customers, or vehicles via this plugin's MCP tools (REST v3). Prefer these tools over guessing endpoints or fields.
---

ShopMonkey REST v3 plugin. Tools return official API JSON (`{ success, data, meta? }` on success; `{ success, code, message, documentation_url, data? }` on error). Do not invent API data, fields, IDs, prices, or endpoints.

## Domain types (short core; responses may include more official fields)

- Order = { id, number, publicId, companyId, locationId, customerId, vehicleId, status, name, coalescedName, authorized, invoiced, paid, workflowStatusId, totalCostCents, createdDate }. `status` is Estimate | RepairOrder | Invoice.
- Customer = { id, publicId, companyId, customerType, firstName, lastName, companyName, emails, phoneNumbers, locationIds, createdDate }. `emails` / `phoneNumbers` are resource extras, not table columns.
- Vehicle = { id, companyId, year, make, model, vin, licensePlate, mileage, mileageUnit, size, type, locationIds }

## Auth

Variable `SM_TOKEN` (Plugins → Configure). Sent as `Authorization: Bearer ${SM_TOKEN}`. API key, not an OAuth dance. No company/location headers. Base: `https://api.shopmonkey.cloud/v3` (HTTPS required).

## Tool → path

| Tool | Method | Path |
|---|---|---|
| shopmonkey_auth_status | GET | /v3/auth/api_key/status |
| shopmonkey_list_orders | GET | /v3/order |
| shopmonkey_get_order | GET | /v3/order/:id |
| shopmonkey_create_order | POST | /v3/order |
| shopmonkey_search_customers | POST | /v3/customer/search |
| shopmonkey_get_customer | GET | /v3/customer/:id |
| shopmonkey_create_customer | POST | /v3/customer |
| shopmonkey_list_customer_vehicles | GET | /v3/customer/:id/vehicle |
| shopmonkey_get_vehicle | GET | /v3/vehicle/:id |
| shopmonkey_create_vehicle | POST | /v3/vehicle |

Create customer requires `customerType` (Customer | Fleet). Create vehicle requires `size` (HeavyDuty | LightDuty | Other). Create order has no required body fields. Customer search body may be empty. There is no shop-wide vehicle list and no POST /v3/order/search — do not call them.
