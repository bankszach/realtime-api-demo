export const toolDefinitions = [
  {
    type: "function",
    name: "getTime",
    description: "Get the current time as an ISO string. Optional timezone IANA name.",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "IANA timezone, e.g. 'America/Los_Angeles'"
        }
      }
    }
  }
];

export function getTime(args = {}) {
  const { timezone } = args || {};
  try {
    if (timezone) {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
      return { iso: new Date().toISOString(), formatted: fmt.format(new Date()) };
    }
  } catch (_) {}
  return { iso: new Date().toISOString() };
}

