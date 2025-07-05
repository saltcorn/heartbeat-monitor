const si = require("systeminformation");
const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");

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
        const [fsInfo] = await si.fsSize();
        const diskUsed = fsInfo
          ? Math.round((fsInfo.used / fsInfo.size) * 100)
          : 0;

        const memInfo = await si.mem();
        const memUsed = Math.round((memInfo.active / memInfo.total) * 100);

        const cpuLoad = Math.round((await si.currentLoad()).currentLoad);

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
        };

        res.set("Cache-Control", "no-store");
        return res.send(json);
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
