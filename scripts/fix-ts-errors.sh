#!/bin/bash

# Script to fix common TypeScript errors in app/api routes

# Fix unused request parameters
find /home/nic20/ProjetosWeb/ServiceDesk/app/api -name "route.ts" -type f -exec sed -i \
  -e 's/export async function [A-Z]*(\s*request: NextRequest,/export async function \U\0(_request: NextRequest,/g' \
  {} \;

echo "TypeScript error fixes applied"
