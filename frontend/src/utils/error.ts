export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error && typeof error === 'object') {
    const withResponse = error as {
      response?: {
        data?: {
          detail?: unknown;
        };
      };
      message?: unknown;
    };

    const detail = withResponse.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (detail !== undefined) {
      try {
        return JSON.stringify(detail);
      } catch {
        /* ignore JSON serialization issues */
      }
    }

    if (typeof withResponse.message === 'string' && withResponse.message.trim()) {
      return withResponse.message;
    }
  }

  return fallback;
}
