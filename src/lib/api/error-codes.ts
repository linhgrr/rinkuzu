import errorCodeContract from '../../../contracts/api-error-codes.json';

type ErrorCodeContract = {
  defaultMessagesByCode: Record<string, string>;
  httpStatusToCode: Record<string, string>;
};

const contract = errorCodeContract as ErrorCodeContract;

const DEFAULT_API_ERROR_MESSAGE_BY_CODE = contract.defaultMessagesByCode;
const API_ERROR_CODE_BY_STATUS = contract.httpStatusToCode;
export function getDefaultApiErrorMessage(code: string): string {
  return DEFAULT_API_ERROR_MESSAGE_BY_CODE[code] ?? 'Request failed';
}

export function getApiErrorCodeFromStatus(status: number): string {
  return API_ERROR_CODE_BY_STATUS[String(status)] ?? 'internal_error';
}
