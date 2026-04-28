#!/bin/bash

# Script to initialize MySQL database on Azure VM
# Run this script on your Azure VM after setting up MySQL

# Database configuration
DB_HOST=${DB_HOST:-localhost}
DB_USER=${DB_USER:-root}
DB_PASSWORD=${DB_PASSWORD:-rootpassword}
DB_NAME=${DB_NAME:-yovi_db}

SCHEMA_FILE="./database/init.sql"

echo "Initializing MySQL database..."


mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD << EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME;
EOF

if [[ $? -ne 0 ]]; then
    echo "Error creating database $DB_NAME"
    exit 1
fi

echo "Database $DB_NAME created or already exists."

mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < $SCHEMA_FILE

if [[ $? -eq 0 ]]; then
    echo "All tables initialized successfully!"
else
    echo "Failed to initialize tables from $SCHEMA_FILE!"
    exit 1
fi
