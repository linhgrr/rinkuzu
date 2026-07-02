export interface RegisterAccountDto {
  email: string;
  password: string;
  displayName?: string;
}

export interface RegisterAccountResponseDto {
  email: string;
}

export interface EmailResponseDto {
  email: string;
}
