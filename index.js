const si = require("systeminformation");
const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const MetaData = require("@saltcorn/data/models/metadata");

const configuration_workflow = () => {
  return new Workflow({
    steps: [
      {
        name: "Heartbeat configuration",
        form: async () => {
          return new Form({
            blurb:
              "Set resource thresholds below. If the usage exceeds these thresholds, the corresponding status will be set to 'critical'.",
            fields: [
              {
                name: "disk_critical_pct",
                label: "Disk usage critical threshold (%)",
                type: "Integer",
                required: true,
                default: 80,
              },
              {
                name: "mem_critical_pct",
                label: "Memory usage critical threshold (%)",
                type: "Integer",
                required: true,
                default: 80,
              },
              {
                name: "cpu_critical_pct",
                label: "CPU usage critical threshold (%)",
                type: "Integer",
                required: true,
                default: 90,
              },
              {
                name: "max_daily_restarts",
                label: "Maximum number of restarts in 24 hours",
                type: "Integer",
                required: true,
                default: 5,
              },
              {
                name: "min_role",
                label: "Minimum user role to access heartbeat",
                type: "String",
                attributes: {
                  options: ["admin", "staff", "user", "public"],
                  multiple: false,
                },
                required: true,
              },
            ],
          });
        },
      },
    ],
  });
};

const routes = (cfg) => [
  {
    method: "get",
    url: "/heartbeat",
    callback: async ({ req, res }) => {
      try {
        const minRole =
          {
            admin: 1,
            staff: 40,
            user: 80,
            public: 100,
          }[cfg.min_role] || 100;

        if ((req?.user?.role_id || 100) > minRole) {
          return res.status(403).json({ error: "Access denied" });
        }

        const [fsInfo] = await si.fsSize();
        const diskUsed = fsInfo
          ? Math.round((fsInfo.used / fsInfo.size) * 100)
          : 0;

        const memInfo = await si.mem();
        const memUsed = Math.round((memInfo.active / memInfo.total) * 100);

        const cpuLoad = Math.round((await si.currentLoad()).currentLoad);

        const startUpQuery = `
          SELECT COUNT(*) AS startup_last_24h
          FROM   _sc_event_log
          WHERE  event_type = 'Startup'
          AND  occur_at >= CAST(strftime('%s','now','-24 hours') AS INTEGER) * 1000;
        `;

        const dailyRestarts =
          (await db?.query(startUpQuery))?.rows[0]?.startup_last_24h || 0;

        const auto_backup_frequency = getState().getConfig(
          "auto_backup_frequency"
        );

        const frequencyMinutes =
          {
            Never: Infinity,
            Daily: 1440,
            Weekly: 10080,
          }[auto_backup_frequency] || Infinity;

        const latestBackupMetadata = await MetaData.find(
          {
            type: "Backup",
            name: "Success",
          },
          { orderBy: "written_at", orderDesc: true, limit: 1 }
        );

        const backupStatus = latestBackupMetadata?.[0]
          ? Date.now() -
              new Date(latestBackupMetadata[0].written_at).getTime() <=
            frequencyMinutes * 1.5 * 60 * 1000
            ? "ok"
            : "critical"
          : "unknown";

        const json = {
          diskspace: {
            status: diskUsed >= cfg.disk_critical_pct ? "critical" : "ok",
            usage: String(diskUsed),
          },
          memory: {
            status: memUsed >= cfg.mem_critical_pct ? "critical" : "ok",
            usage: String(memUsed),
          },
          cpu: {
            status: cpuLoad >= cfg.cpu_critical_pct ? "critical" : "ok",
            percentage: String(cpuLoad),
          },
          systemStability: {
            status: dailyRestarts >= cfg.max_daily_restarts ? "critical" : "ok",
          },
          lastBackup: {
            status: backupStatus,
          },
        };

        res.set("Cache-Control", "no-store");
        return res.json(json);
      } catch (err) {
        return res.status(500).json({ error: "Heartbeat Failure" });
      }
    },
  },
];

module.exports = {
  sc_plugin_api_version: 1,
  plugin_name: "heartbeat-monitor",
  configuration_workflow,
  routes,
};
