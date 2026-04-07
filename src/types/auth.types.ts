export type DocumentType = 'C' | 'T' | 'P' | 'E' | 'R';

export interface LoginCredentials {
  epsId: string;
  documentType: DocumentType;
  documentNumber: string;
  password: string;
}

//Resultado de la autenticacion : repsuesta
export interface LoginResponse {
  success: boolean;
  sessionId?: string;
  message: string;
  expiresAt?: string;
}