#!/bin/bash

# Script to initialize MySQL database on Azure VM
# Run this script on your Azure VM after setting up MySQL

# Database configuration
DB_HOST=${DB_HOST:-localhost}
DB_USER=${DB_USER:-root}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME:-yovi_db}

echo "Initializing MySQL database..."

# Create database and table
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD << EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME;
USE $DB_NAME;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOF

if [ $? -eq 0 ]; then
    echo "Database initialized successfully!"
else
    echo "Failed to initialize database!"
    exit 1
fi
