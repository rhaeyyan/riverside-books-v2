# Riverside Books

This repository contains the software suite for Riverside Books, a single-location independent bookstore. The project aims to modernize the customer experience and staff operations without turning the business into a large e-commerce platform.

This is a monorepo containing four interconnected products built as part of the Cycle 4 fellowship assignment.

## Products

### Product A: Customer Ordering & Loyalty App
A frontend application that allows customers to search the store's catalog, check real-time stock levels, place pre-orders for in-store pickup, and track their loyalty rewards.

### Product B: Staff Inventory & Ops Dashboard
An operational dashboard for the store staff and owner to monitor live stock levels, flag low/out-of-stock titles, and manage pending pre-orders.

### Product C: Customer Support Chatbot
A customer support agent that answers common questions (store hours, return policy, event schedules) and performs live stock checks. **Note:** This is built using a deterministic approach (e.g., decision trees and exact matching) rather than generative AI.

### Product D: Marketing Content Generator
An internal tool that automatically generates social media captions and post ideas based on book metadata or upcoming events, using strict string templating.

## Tech Stack
- **Frontend**: React + TypeScript (Vite)
- **Backend**: Python 3.12 (FastAPI)
- **Database**: Local mock data (JSON/in-memory) instead of a live database.

## Project Structure
- `apps/customer-app/` - Source code for Product A
- `apps/staff-dashboard/` - Source code for Product B
- `backend/api/` - Shared backend API exposing mock data to the frontends
- `backend/chatbot/` - Source code for Product C (Deterministic Chatbot)
- `backend/marketing/` - Source code for Product D (Deterministic Content Generator)
- `mock_data/` - Mock JSON files acting as the store's central database for inventory, orders, and events

## Running Locally
*(Instructions for starting the frontends and backend will be added as the scaffolding is completed).*
