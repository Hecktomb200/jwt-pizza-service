const os = require("os");
const config = require("./config");

class Metrics {
  requests = {};
  HTTPrequests = {};
  revenue = 0;
  sold = 0;
  pizzaFails = 0;
  authSuccess = 0;
  authFail = 0;
  activeUsers = 0;
  pizzaLatency = 0;
  latency = 0;

  constructor() {}

  interval() {
    setInterval(() => {
      const cpuValue = this.getCpuUsagePercentage();
      this.sendMetricToGrafana("cpu_percentage", cpuValue, "gauge", "%");

      const memoryValue = Math.round(this.getMemoryUsagePercentage());
      this.sendMetricToGrafana("memory_percentage", memoryValue, "gauge", "%");

      Object.keys(this.requests).forEach((endpoint) => {
        this.sendMetricToGrafanaObject("requests", this.requests[endpoint], {
          endpoint,
        });
      });

      Object.keys(this.HTTPrequests).forEach((method) => {
        this.sendMetricToGrafanaObject("HTTPrequests", this.HTTPrequests[method], {
          method,
        });
      });

      this.sendMetricToGrafana("sold_pizzas_total", this.sold, "sum", "1");
      this.sendMetricToGrafana("revenue_total", Math.round(this.revenue * 100), "sum", "1");
      this.sendMetricToGrafana("failed_pizzas_total", this.pizzaFails, "sum", "1");
      this.sendMetricToGrafana("auth_success_total", this.authSuccess, "sum", "1");
      this.sendMetricToGrafana("auth_fail_total", this.authFail, "sum", "1");
      this.sendMetricToGrafana("active_users_total", this.activeUsers, "sum", "1");
      this.sendMetricToGrafana("pizza_latency_milliseconds_total", this.pizzaLatency, "sum", "ms");
      this.sendMetricToGrafana("latency_milliseconds_total", this.latency, "sum", "ms");
    }, 1000);
  }

  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return cpuUsage.toFixed(2) * 100;
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
  }

  track(endpoint) {
    return (req, res, next) => {
      const start = Date.now();
      const method = req.method;

      this.HTTPrequests[method] = (this.HTTPrequests[method] || 0) + 1;
      this.requests[endpoint] = (this.requests[endpoint] || 0) + 1;

      res.on("finish", () => {
        this.latency = Date.now() - start;
      });
      next();
    };
  }

  order(price, pizzas) {
    this.revenue += price;
    this.sold += pizzas;
  }

  orderFail() {
    this.pizzaFails += 1;
  }

  auth(status) {
    if (status) {
      this.authSuccess += 1;
    } else {
      this.authFail += 1;
    }
  }

  activeUser (status) {
    if (status) {
      this.activeUsers += 1;
    } else {
      this.activeUsers -= 1;
    }
  }

  trackPizzaLatency(time) {
    this.pizzaLatency = time;
  }

  sendMetricToGrafana(metricName, metricValue, type, unit) {
    const metric = {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [
                {
                  name: metricName,
                  unit: unit,
                  [type]: {
                    dataPoints: [
                      {
                        asInt: metricValue,
                        timeUnixNano: Date.now() * 1000000,
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    if (type === "sum") {
      metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality = "AGGREGATION_TEMPORALITY_CUMULATIVE";
      metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
    }

    const body = JSON.stringify(metric);
    fetch(`${config.metrics.url}`, {
      method: "POST",
      body: body,
      headers: {
        Authorization: `Bearer ${config.metrics.apiKey}`,
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          response.text().then((text) => {
            console.error(`Failed to push metrics data to Grafana: ${text}\n${body}`);
          });
        }
      })
      .catch((error) => {
        console.error("Error pushing metrics:", error);
      });
  }

  sendMetricToGrafanaObject(metricName, metricValue, attributes) {
    attributes = { ...attributes, source: config.source };

    const metric = {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [
                {
                  name: metricName,
                  unit: "1",
                  sum: {
                    dataPoints: [
                      {
                        asInt: metricValue,
                        timeUnixNano: Date.now() * 1000000,
                        attributes: [],
                      },
                    ],
                    aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
                    isMonotonic: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    Object.keys(attributes).forEach((key) => {
      metric.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints[0].attributes.push({
        key: key,
        value: { stringValue: attributes[key] },
      });
    });

    fetch(`${config.metrics.url}`, {
      method: "POST",
      body: JSON.stringify(metric),
      headers: {
        Authorization: `Bearer ${config.metrics.apiKey}`,
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          console.error("Failed to push metrics data to Grafana");
        }
      })
      .catch((error) => {
        console.error("Error pushing metrics:", error);
      });
  }
}

const metric = new Metrics();
module.exports = metric;
