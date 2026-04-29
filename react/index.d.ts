import { ReactNode } from "react";
import type { DashClient } from "../index";

// ============================================================================
// Cart Types
// ============================================================================

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  size_id: string;
  size_label: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  stock_available: number;
}

export interface CartContextType {
  items: CartItem[];
  cartId: string | null;
  itemCount: number;
  totalItemCount: number;
  subtotal: string;
  isLoading: boolean;
  addItem: (productId: string, sizeId: string, quantity?: number) => Promise<any>;
  updateItem: (sizeId: string, quantity: number) => Promise<void>;
  removeItem: (sizeId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  transferToUser: (authToken?: string) => Promise<void>;
}

export interface CartProviderProps {
  children: ReactNode;
  client: DashClient;
  storageKey?: string;
}

export function CartProvider(props: CartProviderProps): JSX.Element;
export function useCart(): CartContextType;

// ============================================================================
// Auth Types
// ============================================================================

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  emailVerified: boolean;
}

export interface AuthContextType {
  customer: Customer | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (email: string, password: string, additionalData?: Record<string, any>) => Promise<any>;
  requestOTP: (email: string) => Promise<any>;
  loginWithOTP: (email: string, code: string) => Promise<any>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Customer>) => Promise<any>;
  refreshProfile: () => Promise<void>;
}

export interface AuthProviderProps {
  children: ReactNode;
  client: DashClient;
  tokenKey?: string;
  customerKey?: string;
  onLogin?: (customer: Customer) => void;
  onLogout?: () => void;
}

export function AuthProvider(props: AuthProviderProps): JSX.Element;
export function useAuth(): AuthContextType;

// ============================================================================
// Combined Provider
// ============================================================================

export interface DashProviderProps {
  children: ReactNode;
  client: DashClient;
}

export function DashProvider(props: DashProviderProps): JSX.Element;
export function useDash(): { client: DashClient };

// ============================================================================
// DashImage
// ============================================================================

export interface DashImageVariant {
  width: number;
  url: string;
}

export interface DashImageData {
  url: string;
  lqip?: string | null;
  variants_ready?: boolean;
  variants?: {
    webp?: DashImageVariant[];
    avif?: DashImageVariant[];
  };
  width?: number;
  height?: number;
}

export interface DashImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  image: DashImageData | null | undefined;
  alt?: string;
  sizes?: string;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  blurDisabled?: boolean;
}

export function DashImage(props: DashImageProps): JSX.Element | null;

// ============================================================================
// SignaturePad
// ============================================================================

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
}

export interface SignaturePadProps {
  /** Existing signature as a base64 PNG `data:` URL. Empty string = blank. */
  value?: string;
  /** Fires after every stroke completes, with the canvas as a PNG data URL. */
  onChange?: (value: string) => void;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Hex stroke color. Defaults to ink. */
  strokeColor?: string;
  /** Background fill (defaults to transparent). */
  backgroundColor?: string;
  /** Read-only mode — renders an existing signature without controls. */
  disabled?: boolean;
  clearLabel?: string;
  placeholder?: string;
  signedLabel?: string;
  /** Hide the status row (label + Clear button). */
  showStatus?: boolean;
}

export const SignaturePad: React.ForwardRefExoticComponent<
  SignaturePadProps & React.RefAttributes<SignaturePadHandle>
>;

// ============================================================================
// useHealthDashForm
// ============================================================================

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldShowWhen {
  field: string;
  equals: unknown;
}

export interface FormFieldSchema {
  name: string;
  label: string;
  type:
    | "text"
    | "email"
    | "tel"
    | "date"
    | "url"
    | "number"
    | "hidden"
    | "textarea"
    | "select"
    | "multiselect"
    | "checkbox"
    | "radio"
    | "file"
    | "signature"
    | (string & {});
  required?: boolean;
  required_message?: string;
  placeholder?: string;
  help_text?: string;
  options?: FormFieldOption[];
  show_when?: FormFieldShowWhen | null;
  max_length?: number;
  min_length?: number;
  signature_width?: number;
  signature_height?: number;
  [key: string]: unknown;
}

export interface FormFieldAccessor {
  name: string;
  label: string;
  helpText?: string;
  type?: string;
  required?: boolean;
  options?: FormFieldOption[];
  visible: boolean;
  value: unknown;
  set: (value: unknown) => void;
  error: string | null;
  touched: boolean;
  /** Returns a fully-configured React element for this field type. */
  input: (extraProps?: Record<string, unknown>) => JSX.Element | null;
  missing: boolean;
}

export interface UseHealthDashFormOptions {
  /** Explicit client (defaults to DashProvider's). */
  client?: DashClient;
  /** Pre-fill values keyed by field name. */
  initialValues?: Record<string, unknown>;
  onSuccess?: (response: unknown) => void;
  onError?: (error: unknown) => void;
}

export interface UseHealthDashFormResult {
  slug: string;
  title: string;
  description: string;
  fields: FormFieldSchema[];

  loading: boolean;
  loadError: string | null;

  field: (name: string) => FormFieldAccessor;

  handleSubmit: (
    onSuccess?: (response: unknown) => void,
  ) => (event?: React.FormEvent | { preventDefault?: () => void }) => Promise<void>;
  submitting: boolean;
  success: boolean;
  successMessage: string;
  redirectUrl: string;
  formError: string | null;
  score:
    | null
    | {
        total?: number;
        band_label?: string;
        band_severity?: string;
        [key: string]: unknown;
      };

  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  setFieldValue: (name: string, value: unknown) => void;
  setValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  reset: () => void;
}

export function useHealthDashForm(
  slug: string,
  options?: UseHealthDashFormOptions,
): UseHealthDashFormResult;
