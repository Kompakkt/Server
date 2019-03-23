export interface Model {
    _id?: string;
    relatedDigitalObject?: any;
    name: string;
    cameraPosition?: Array<{ dimension: string; value: number }>;
    referencePoint?: Array<{ dimension: string; value: number }>;
    ranking?: number;
    files: string[];
    finished: boolean;
    online: boolean;
    processed?: {
        time?: {
            start: string;
            end: string;
            total: string;
        };
        low?: string;
        medium?: string;
        high?: string;
        raw?: string;
    };
    preview?: string;
}
