#!/bin/bash
# Install Python dependencies
pip install -r requirements.txt

# Ensure npm is installed (Render's Python environment usually has Node installed, but let's be safe)
npm install -g npm@latest || echo "npm already available"

# Build the Customer App
echo "Building Customer App..."
cd apps/customer-app
npm install
npm run build
cd ../..

# Build the Staff Dashboard
echo "Building Staff Dashboard..."
cd apps/staff-dashboard
npm install
npm run build
cd ../..

echo "Build complete! All frontends are ready to be served by FastAPI."
