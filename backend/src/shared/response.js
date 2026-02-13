/**
 * Shared response helpers for Lambda handlers.
 */

export function success(body, statusCode = 200) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
        },
        body: JSON.stringify(body),
    };
}

export function error(message, statusCode = 500) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: message }),
    };
}

export function parseBody(event) {
    if (!event.body) return {};
    try {
        return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
        return {};
    }
}
