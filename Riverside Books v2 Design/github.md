repo: rhaeyyan/riverside-books-v2
branch: main

## Last sync

date: 2026-08-25T17:38:13Z

### Updated in this project

- Recreated the customer app (Product A + C chat panel) and staff dashboard (Products B + D) as high-fidelity designs.
- Applied the `docs/design.md` palette, Fraunces/Inter type pairing, and binding stock-status colors in place of the Vite-starter purple.
- Rebuilt the staff inventory screen as a glance surface: large clickable alert numerals, status stripes, inline count edit.
- All screen content uses real records from `mock_data/` (inventory, orders, customers, events, messages).
- Redesigned the unified gateway landing page in the same system, with live stock signals on the staff card.

## Screen map

| Project screen | Built from |
|---|---|
| Riverside Customer App.dc.html — Browse | apps/customer-app/src/pages/Home.tsx, src/App.tsx, src/App.css, src/index.css |
| Riverside Customer App.dc.html — Book detail + hold | apps/customer-app/src/pages/BookDetail.tsx |
| Riverside Customer App.dc.html — My holds | apps/customer-app/src/pages/MyOrders.tsx, mock_data/orders.json |
| Riverside Customer App.dc.html — Stamp card | apps/customer-app/src/pages/LoyaltyCard.tsx, mock_data/customers.json |
| Riverside Customer App.dc.html — Chat panel | apps/customer-app/src/components/ChatPanel.tsx, backend/chatbot/tree.py, mock_data/store_info.json |
| Riverside Staff Dashboard.dc.html — Inventory | apps/staff-dashboard/src/pages/Inventory.tsx + Inventory.css, mock_data/inventory.json |
| Riverside Staff Dashboard.dc.html — Pre-orders | apps/staff-dashboard/src/pages/Preorders.tsx + Preorders.css, mock_data/orders.json |
| Riverside Staff Dashboard.dc.html — Messages | apps/staff-dashboard/src/pages/Messages.tsx, mock_data/messages.json |
| Riverside Staff Dashboard.dc.html — Marketing | apps/staff-dashboard/src/pages/Marketing.tsx, backend/marketing/templates.py, mock_data/events.json |
| Riverside Gateway.dc.html | web/index.html, README.md (Unified Demo Mode) |
| Shared shell / nav | apps/staff-dashboard/src/App.tsx + App.css, apps/customer-app/src/App.tsx |
| Design tokens & type | docs/design.md, apps/*/src/index.css |
