const buildDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return { filter: null, invalidField: null };

  const filter = {};
  for (const [field, value, operator] of [
    ['startDate', startDate, '$gte'],
    ['endDate', endDate, '$lte'],
  ]) {
    if (value === undefined) continue;
    if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
      return { filter: null, invalidField: field };
    }
    filter[operator] = new Date(value);
  }

  return { filter, invalidField: null };
};

module.exports = buildDateRange;
