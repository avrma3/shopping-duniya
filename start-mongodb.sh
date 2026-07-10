#!/bin/bash

# Create MongoDB data directory
mkdir -p /tmp/mongodb/data

# Start MongoDB in background
mongod --dbpath /tmp/mongodb/data --port 27017 --bind_ip 0.0.0.0 --fork --logpath /tmp/mongodb/mongod.log

# Wait for MongoDB to start
sleep 3

# Check if MongoDB is running
if pgrep mongod > /dev/null; then
    echo "✅ MongoDB started successfully"
    echo "📊 Database path: /tmp/mongodb/data"
    echo "🔗 Connection: mongodb://localhost:27017"
else
    echo "❌ Failed to start MongoDB"
fi