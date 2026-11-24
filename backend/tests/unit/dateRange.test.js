const buildDateRange = require('../../controllers/dateRange');

describe('buildDateRange', () => {
  test('returns no filter when no dates are supplied', () => {
    expect(buildDateRange(undefined, undefined)).toEqual({ filter: null, invalidField: null });
  });

  test('builds an inclusive lower and upper date filter', () => {
    expect(buildDateRange('2026-10-01', '2026-10-31')).toEqual({
      filter: { $gte: new Date('2026-10-01'), $lte: new Date('2026-10-31') },
      invalidField: null,
    });
  });

  test.each([
    ['not-a-date', undefined, 'startDate'],
    [undefined, 'not-a-date', 'endDate'],
    [{ $ne: null }, undefined, 'startDate'],
  ])('rejects invalid %s input', (startDate, endDate, invalidField) => {
    expect(buildDateRange(startDate, endDate)).toEqual({ filter: null, invalidField });
  });
});
