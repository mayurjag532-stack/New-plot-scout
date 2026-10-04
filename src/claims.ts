export type ClaimField =
  | "price" | "area" | "state" | "district" | "taluka" | "village" | "locality"
  | "coordinates" | "gat_number" | "survey_number" | "seller_identity" | "broker_identity"
  | "contact" | "listing_date" | string;

export type ClaimExtractionMethod = "SHARED_RAW" | "STRUCTURED_DATA" | "DETERMINISTIC_PARSER" | "GEOCODER" | "USER_CONFIRMED" | "AI_ASSISTED";
export type ClaimVerificationStatus = "UNVERIFIED" | "CORROBORATED" | "VERIFIED" | "CONFLICT" | "REJECTED";

export interface LeadClaim {
  id: string;
  leadId: string;
  field: ClaimField;
  rawValue: string;
  normalizedValue?: string | number | { lat: number; lon: number };
  unit?: string;
  sourceEvidenceId: string;
  extractionMethod: ClaimExtractionMethod;
  confidence: number; // 0..1; confidence is not verification
  verificationStatus: ClaimVerificationStatus;
  createdAt: number;
  verifiedAt?: number;
  notes?: string;
}
