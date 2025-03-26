const config = require("./config");
const os = require("os");

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

  /*
  postrequest = 0;

  increasePostRequests() {
    this.postrequests++;
  }


  - in router
  authrouter.post('/', (req, res) => {
      Metrics.increasePostRequests()
    })

  */

  constructor() {}

  interval() {
    setInterval(() => {
      const cpuValue = this.getCpuUsagePercentage();
      this.sendMetricToGrafana("cpu", cpuValue, "gauge", "%");

      const memoryValue = Math.round(this.getMemoryUsagePercentage());
      //console.log("Memory Usage Value:", memoryValue, typeof memoryValue);
      this.sendMetricToGrafana("memory", memoryValue, "gauge", "%");

      //this.requests += Math.floor(Math.random() * 200) + 1;
      //this.sendMetricToGrafana("requests", this.requests, "sum", "1");

      Object.keys(this.requests).forEach((endpoint) => {
        //console.log(endpoint, " has ", this.requests[endpoint]);
        this.sendMetricToGrafanaObject("requests", this.requests[endpoint], {
          endpoint,
        });
      });

      Object.keys(this.HTTPrequests).forEach((method) => {
        //console.log(method, " has ", this.HTTPrequests[method]);
        this.sendMetricToGrafanaObject(
          "HTTPrequests",
          this.HTTPrequests[method],
          {
            method,
          }
        );
      });

      let rich = this.revenue * 100;

      this.sendMetricToGrafana("sold_pizzas", this.sold, "sum", "1");
      this.sendMetricToGrafana("revenue", parseInt(rich), "sum", "1");
      this.sendMetricToGrafana("failed_pizzas", this.pizzaFails, "sum", "1");
      this.sendMetricToGrafana("auth_success", this.authSuccess, "sum", "1");
      this.sendMetricToGrafana("auth_fail", this.authFail, "sum", "1");

      this.sendMetricToGrafana("active_users", this.activeUsers, "sum", "1");
      this.sendMetricToGrafana("pizza_latency", this.pizzaLatency, "sum", "ms");
      this.sendMetricToGrafana("latency", this.latency, "sum", "ms");

      /*
      console.log("Revenue: ", this.revenue);
      console.log("Sold: ", this.sold);
      console.log("Failed: ", this.pizzaFails);

      console.log("Pizza Latency: " + this.pizzaLatency);
      console.log("Latency: " + this.latency);
      */
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

      //console.log(method);
      this.HTTPrequests[method] = (this.HTTPrequests[method] || 0) + 1;
      //Track endpoints
      this.requests[endpoint] = (this.requests[endpoint] || 0) + 1;
      //console.log(`Tracking ${endpoint} request`);

      res.on("finish", () => {
        this.latency = Date.now() - start;
      });
      next();
    };
  }

  order(price, pizzas) {
    this.revenue = this.revenue + price;
    this.sold = this.sold + pizzas;
  }

  orderFail() {
    this.pizzaFails = this.pizzaFails + 1;
  }

  auth(status) {
    if (status) {
      this.authSuccess = this.authSuccess + 1;
    } else {
      this.authFail = this.authFail + 1;
    }
  }

  activeUser(status) {
    if (status) {
      this.activeUsers = this.activeUsers + 1;
    } else {
      this.activeUsers = this.activeUsers - 1;
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
      metric.resourceMetrics[0].scopeMetrics[0].metrics[0][
        type
      ].aggregationTemporality = "AGGREGATION_TEMPORALITY_CUMULATIVE";
      metric.resourceMetrics[0].scopeMetrics[0].metrics[0][
        type
      ].isMonotonic = true;
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
            console.error(
              `Failed to push metrics data to Grafana: ${text}\n${body}`
            );
          });
        } else {
          //console.log(`Pushed ${metricName}`);
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
                    aggregationTemporality:
                      "AGGREGATION_TEMPORALITY_CUMULATIVE",
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
      metric.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints[0].attributes.push(
        {
          key: key,
          value: { stringValue: attributes[key] },
        }
      );
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
        } else {
          //console.log(`Pushed ${metricName}`);
        }
      })
      .catch((error) => {
        console.error("Error pushing metrics:", error);
      });
  }
}

const metric = new Metrics();
module.exports = metric;