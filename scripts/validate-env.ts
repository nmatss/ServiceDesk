#!/usr/bin/env tsx
/**
 * Environment validation script
 * Loads .env file and validates all environment variables
 */

import { config } from 'dotenv';
import { validateEnvironment } from '../lib/config/env';

// Load .env file
config();

// Run validation
validateEnvironment();
