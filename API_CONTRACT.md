# API Contract

## Canonical envelope

### Success

```json
{ "success": true, "data": {}, "meta": {} }
```

`meta` is optional.

### Error

```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "Invalid request",
    "detail": "Email is required",
    "meta": {}
  }
}
```

`detail` and `meta` are optional.

## Status-code rules

- `2xx`: must use success envelope
- `4xx/5xx`: must use error envelope
- `204`: no body

## Frontend rules

- Route handlers: use `apiOk`, `apiErr`, `apiStatusErr`, `apiServiceErr`
- Browser/client fetches: use `fetchApiData` or `fetchApiResponse`
- Do not hand-roll `{ success, data }` or `{ success, error }`

## Python rules

- Success payloads: use `ok(...)`
- Expected failures: raise `AppError`
- FastAPI/global errors: normalized by `register_exception_handlers(...)`
- Do not return ad-hoc JSON error shapes

## Error-code baseline

- `validation_error`
- `unauthorized`
- `forbidden`
- `not_found`
- `conflict`
- `rate_limit_exceeded`
- `service_unavailable`
- `upstream_error`
- `upstream_timeout`
- `internal_error`
