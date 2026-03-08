#!/bin/bash
# Cron job setup for auto-completing events
# This runs every 15 minutes to check for events that should be auto-completed

# Add cron job to run every 15 minutes
echo "*/15 * * * * curl -s https://churchtrack-api.onrender.com/api/cron/auto_complete_events.php > /dev/null 2>&1" | crontab -

echo "Cron job installed: Auto-complete events every 15 minutes"
