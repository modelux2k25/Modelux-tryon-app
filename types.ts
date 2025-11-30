export interface GenerateResponse {
    success: boolean;
    image?: string; // Base64 or URL
    error?: string;
}

export interface WidgetMessage {
    type: 'PRODUCT_IMAGE';
    payload: string;
}

export enum LoadingState {
    IDLE = 'IDLE',
    UPLOADING = 'UPLOADING',
    PROCESSING = 'PROCESSING',
    COMPLETE = 'COMPLETE',
    ERROR = 'ERROR'
}