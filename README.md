# Heartbeat Monitor

This plugin monitors system resources (disk usage, memory usage, CPU load, system stability, and backup status) and provides a heartbeat endpoint (`/heartbeat`) to report their statuses.

## Configuration

You can configure resource thresholds via the plugin settings.

### Default Thresholds
- **Disk usage critical threshold**: 80%
- **Memory usage critical threshold**: 80%
- **CPU usage critical threshold**: 90%
- **Maximum number of restarts in 24 hours**: 5

## Endpoint

### `/heartbeat`
Returns a JSON object with the status and usage of disk space, memory, CPU, system stability, and last backup. Example response:
```json
{
  "diskspace": {
    "status": "ok",
    "usage": "75"
  },
  "memory": {
    "status": "critical",
    "usage": "85"
  },
  "cpu": {
    "status": "ok",
    "percentage": "70"
  },
  "systemStability": {
    "status": "ok"
  },
  "lastBackup": {
    "status": "critical"
  }
}
```