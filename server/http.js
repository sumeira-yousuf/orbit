export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new HttpError(400, msg);
export const forbidden = (msg = 'You do not have permission to do that') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);

/** Rejects start > due. Either may be null/undefined. */
export function checkDates(start, due) {
  if (start && due && start > due) throw badRequest('The start date must be on or before the due date');
}

/** Builds "col = $n" fragments for a partial UPDATE from a whitelist of columns. */
export function buildUpdate(data, allowed, firstParam = 1) {
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      vals.push(data[key]);
      sets.push(`${key} = $${firstParam + vals.length - 1}`);
    }
  }
  return { sets, vals };
}
