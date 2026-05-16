import errorCodeContract from '../../../contracts/api-error-codes.json';

type ErrorCodeContract = {
  defaultMessagesByCode: Record<string, string>;
  httpStatusToCode: Record<string, string>;
  httpStatusToMessage: Record<string, string>;
};

const contract = errorCodeContract as ErrorCodeContract;

export const DEFAULT_API_ERROR_MESSAGE_BY_CODE = contract.defaultMessagesByCode;
export const API_ERROR_CODE_BY_STATUS = contract.httpStatusToCode;
export const API_ERROR_MESSAGE_BY_STATUS = contract.httpStatusToMessage;

export function getDefaultApiErrorMessage(code: string): string {
  return DEFAULT_API_ERROR_MESSAGE_BY_CODE[code] ?? 'Request failed';
}

export function getApiErrorCodeFromStatus(status: number): string {
  return API_ERROR_CODE_BY_STATUS[String(status)] ?? 'internal_error';
}
