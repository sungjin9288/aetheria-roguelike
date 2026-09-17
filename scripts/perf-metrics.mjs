export function validatePerfMetrics(metrics, thresholds) {
  return Object.entries(thresholds).flatMap(([name, limit]) => {
    const value = metrics[name];
    if (!Number.isFinite(value) || value < 0) return [`${name}: missing or invalid metric`];
    return value > limit ? [`${name}: ${value}ms > ${limit}ms`] : [];
  });
}
